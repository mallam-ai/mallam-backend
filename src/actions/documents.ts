import { ActionHandler } from '../types';
import * as schema from '../../schema-main';
import { invokeStanzaSentenceSegmentation } from '../utils';
import { chunk } from 'lodash';
import { Ai } from '@cloudflare/ai';
import { DAO } from '../dao';

const MODEL_EMBEDDINGS = '@cf/baai/bge-base-en-v1.5';

export const document_get: ActionHandler = async function (
	{ env },
	{
		userId,
		documentId,
	}: {
		userId: string;
		documentId: string;
	}
) {
	const dao = new DAO(env);
	const document = await dao.mustDocument(documentId);
	const team = await dao.mustTeam(document.teamId);
	await dao.mustMembership(team.id, userId);
	return { document };
};

export const document_analyze: ActionHandler = async function (
	{ env },
	{
		documentId,
	}: {
		documentId: string;
	}
) {
	const dao = new DAO(env);

	// get document
	const document = await dao.mustDocument(documentId);

	if (document.isAnalyzed) {
		await dao.markDocumentAnalyzed(document.id, false);
		document.isAnalyzed = false;
	}

	// invoke stanza
	const sentenceTexts = await invokeStanzaSentenceSegmentation(env, document.content);

	// delete old sentences
	{
		const sentenceIds = await dao.getSentenceIds(documentId);

		// delete from vectorize database
		await Promise.all(
			chunk(sentenceIds, 10).map((sentenceIds) => {
				return env.VECTORIZE_MAIN_SENTENCES.deleteByIds(sentenceIds);
			})
		);

		await dao.deleteSentences(documentId);
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

	const dao = new DAO(env);

	const document = await dao.mustDocument(documentId);

	const sentence = await dao.createSentence(document, { sequenceId, content });

	const ai = new Ai(env.AI);

	const { data } = await ai.run(MODEL_EMBEDDINGS, {
		text: [content],
	});

	const values = data[0];

	if (!values) {
		throw new Error(`Failed to vectorize sentence ${sentence.id}`);
	}

	await env.VECTORIZE_MAIN_SENTENCES.upsert([
		{
			id: sentence.id,
			values,
			namespace: document.teamId,
			metadata: {
				documentId,
				sequenceId,
			},
		},
	]);

	await dao.markSentenceAnalyzed(sentence.id, true);

	await dao.updateDocumentAnalyzed(documentId);

	return {};
};

export const document_list: ActionHandler = async function (
	{ env },
	{
		userId,
		teamId,
		offset,
		limit,
	}: {
		userId: string;
		teamId: string;
		offset: number;
		limit: number;
	}
) {
	const dao = new DAO(env);

	await dao.mustTeam(teamId);

	await dao.mustMembership(teamId, userId);

	return {
		offset,
		limit,
		total: await dao.countDocuments(teamId),
		documents: await dao.listDocuments(teamId, { offset, limit }),
	};
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
	const dao = new DAO(env);

	await dao.mustTeam(teamId);

	await dao.mustMembership(teamId, userId, schema.membershipRoles.admin, schema.membershipRoles.member);

	const document = await dao.createDocument({ teamId, title, content, createdBy: userId });

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
