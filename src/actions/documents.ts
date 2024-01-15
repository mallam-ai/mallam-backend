import { ActionHandler } from '../types';
import * as schema from '../../schema-main';
import { invokeStanzaSentenceSegmentation } from '../utils';
import { chunk } from 'lodash';
import { Ai } from '@cloudflare/ai';
import { DAO } from '../dao';

const MODEL_EMBEDDINGS = '@cf/baai/bge-base-en-v1.5';

export const document_delete: ActionHandler = async function (
	{ env },
	{
		documentId,
		userId,
	}: {
		documentId: string;
		userId: string;
	}
) {
	const dao = new DAO(env);
	const document = await dao.mustDocument(documentId);
	const team = await dao.mustTeam(document.teamId);
	await dao.mustMembership(team.id, userId, schema.MEMBERSHIP_ROLE.ADMIN, schema.MEMBERSHIP_ROLE.MEMBER);
	const sentenceIds = await dao.getSentenceIds(documentId);
	await Promise.all(chunk(sentenceIds, 10).map((sentenceIds) => env.VECTORIZE_MAIN_SENTENCES.deleteByIds(sentenceIds)));
	await dao.deleteSentences(documentId);
	await dao.deleteDocument(document.id);
	return {};
};

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
	const sentences = await dao.listSentences(documentId);
	return {
		document: Object.assign(document, {
			sentences: sentences.map((s) => s.content),
		}),
	};
};

export const document_update: ActionHandler = async function (
	{ env },
	{
		userId,
		documentId,
		title,
		content,
	}: {
		userId: string;
		documentId: string;
		title: string;
		content: string;
	}
) {
	const dao = new DAO(env);
	const document = await dao.mustDocument(documentId);
	const team = await dao.mustTeam(document.teamId);

	await dao.mustMembership(team.id, userId);

	await dao.deleteSentences(documentId);

	await dao.updateDocument(document.id, { title, content });

	await env.QUEUE_MAIN_DOCUMENT_ANALYZE.send({ documentId }, { contentType: 'json' });

	return {
		document: Object.assign(document, {
			content,
			title,
			isAnalyzed: false,
		}),
	};
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

	// invoke stanza
	const sentenceTexts = await invokeStanzaSentenceSegmentation(env, document.content);

	// create new sentences
	const tasks = sentenceTexts
		.map((content, i) => ({
			documentId,
			sequenceId: i,
			content,
		}))
		.concat([
			{
				documentId,
				sequenceId: -1,
				content: document.title,
			},
		]);

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
	{ sentenceId, documentId, sequenceId, content }: { sentenceId?: string; documentId?: string; sequenceId?: number; content?: string }
) {
	const dao = new DAO(env);

	let sentence: Awaited<ReturnType<typeof dao.mustSentence>>;

	if (sentenceId) {
		sentence = await dao.mustSentence(sentenceId);
	} else if (documentId && sequenceId && content) {
		content = content.trim();

		if (!content) {
			return;
		}

		const document = await dao.mustDocument(documentId);
		sentence = await dao.createSentence(document, { sequenceId, content });
	} else {
		return;
	}

	const ai = new Ai(env.AI);

	const { data } = await ai.run(MODEL_EMBEDDINGS, {
		text: [sentence.content],
	});

	const values = data[0];

	if (!values) {
		throw new Error(`Failed to vectorize sentence ${sentence.id}`);
	}

	await env.VECTORIZE_MAIN_SENTENCES.upsert([
		{
			id: sentence.id,
			values,
			namespace: sentence.teamId,
			metadata: {
				documentId: sentence.documentId,
				sequenceId: sentence.sequenceId,
			},
		},
	]);

	await dao.markSentenceAnalyzed(sentence.id, true);

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

	await dao.mustMembership(teamId, userId, schema.MEMBERSHIP_ROLE.ADMIN, schema.MEMBERSHIP_ROLE.MEMBER);

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
