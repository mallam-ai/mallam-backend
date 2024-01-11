import { ActionHandler } from '../types';
import * as schema from '../../schema-main';
import { drizzle } from 'drizzle-orm/d1';
import { sql, and, isNull, eq, inArray } from 'drizzle-orm';
import { halt, invokeStanzaSentenceSegmentation } from '../utils';
import { chunk } from 'lodash';
import { Ai } from '@cloudflare/ai';

const MODEL_EMBEDDINGS = '@cf/baai/bge-base-en-v1.5';

export const document_analyze: ActionHandler = async function (
	{ env },
	{
		documentId,
	}: {
		documentId: string;
	}
) {
	const db = drizzle(env.DB_MAIN, { schema });

	const document = await db.query.tDocuments.findFirst({ where: eq(schema.tDocuments.id, documentId) });

	if (!document) {
		console.log(`document ${documentId} not found`);
		return;
	}

	// invoke stanza
	const sentenceTexts = await invokeStanzaSentenceSegmentation(env, document.content);

	// delete old sentences
	{
		// find sentence ids
		const sentences = await db
			.select({
				id: schema.tSentences.id,
			})
			.from(schema.tSentences)
			.where(eq(schema.tSentences.documentId, documentId));

		const sentenceIds = sentences.map((s) => s.id);

		// delete from vectorize database
		await Promise.all(
			chunk(sentenceIds, 10).map((sentenceIds) => {
				return env.VECTORIZE_MAIN_SENTENCES.deleteByIds(sentenceIds);
			})
		);

		// delete from d1 database
		await db.delete(schema.tSentences).where(eq(schema.tSentences.documentId, documentId));
	}

	// create new sentences
	const tasks = sentenceTexts.map((content, i) => ({
		documentId,
		sequenceId: i,
		content,
	}));

	// include title
	tasks.push({
		documentId,
		sequenceId: -1,
		content: document.title,
	});

	// send to queue
	await Promise.all(
		chunk(tasks, 10).map((tasks) => {
			return env.QUEUE_MAIN_SENTENCE_ANALYZE.sendBatch(tasks.map((body) => ({ body, contentType: 'json' })));
		})
	);

	return {};
};

export const sentence_analyze: ActionHandler = async function (
	{ env },
	{ documentId, sequenceId, content }: { documentId: string; sequenceId: number; content: string }
) {
	if (content.trim().length === 0) {
		return;
	}

	const db = drizzle(env.DB_MAIN, { schema });

	const document = await db.query.tDocuments.findFirst({ where: eq(schema.tDocuments.id, documentId) });

	if (!document) {
		console.log(`document ${documentId} not found`);
		return;
	}

	const id = `${documentId}#${sequenceId}`;

	const sentence = await db
		.insert(schema.tSentences)
		.values({
			id,
			documentId,
			teamId: document.teamId,
			sequenceId,
			content,
			createdBy: document.createdBy,
			createdAt: new Date(),
		})
		.onConflictDoNothing()
		.returning();

	const ai = new Ai(env.AI);

	const { data } = await ai.run(MODEL_EMBEDDINGS, {
		text: [content],
	});

	const values = data[0];

	if (!values) {
		throw new Error(`Failed to vectorize sentence ${id}`);
	}

	await env.VECTORIZE_MAIN_SENTENCES.upsert([
		{
			id,
			values,
			namespace: document.teamId,
			metadata: {
				documentId,
				sequenceId,
			},
		},
	]);

	return {};
};

export const document_create: ActionHandler = async function (
	{ env },
	{
		title,
		content,
		teamId,
		userId,
	}: {
		title: string;
		content: string;
		teamId: string;
		userId: string;
	}
) {
	const db = drizzle(env.DB_MAIN, { schema });

	const team = await db.query.tTeams.findFirst({ where: and(eq(schema.tTeams.id, teamId), isNull(schema.tTeams.deletedAt)) });

	{
		if (!team) {
			halt(`team ${teamId} not found`, 404);
		}

		const membership = await db.query.tMemberships.findFirst({
			where: and(
				eq(schema.tMemberships.userId, userId),
				eq(schema.tMemberships.teamId, teamId),
				inArray(schema.tMemberships.role, [schema.membershipRoles.admin, schema.membershipRoles.member])
			),
		});

		if (!membership) {
			halt(`user ${userId} is not a member of team ${teamId}`, 403);
		}
	}

	const document = (
		await db
			.insert(schema.tDocuments)
			.values({
				id: crypto.randomUUID(),
				teamId,
				isPublic: false,
				title,
				content,
				createdBy: userId,
				createdAt: new Date(),
			})
			.returning()
	)[0];

	await env.QUEUE_MAIN_DOCUMENT_ANALYZE.send(
		{
			documentId: document.id,
		},
		{
			contentType: 'json',
		}
	);

	return { document };
};
