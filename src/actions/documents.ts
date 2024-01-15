import { ActionHandler } from '../types';
import * as schema from '../../schema-main';
import { invokeStanzaSentenceSegmentation } from '../utils';
import { chunk, flatten } from 'lodash';
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

export const document_analysis_failed: ActionHandler = async function (
	{ env },
	{
		documentId,
	}: {
		documentId: string;
	}
) {
	const dao = new DAO(env);

	await dao.updateDocumentStatus(documentId, schema.DOCUMENT_STATUS.FAILED);
};

export const document_analysis: ActionHandler = async function (
	{ env },
	{
		documentId,
	}: {
		documentId: string;
	}
) {
	const dao = new DAO(env);

	const document = await dao.mustDocument(documentId);

	if (document.status === schema.DOCUMENT_STATUS.ANALYZED || document.status === schema.DOCUMENT_STATUS.FAILED) {
		return;
	}

	let sentences = await dao.listSentences(document.id);

	// CREATED -> SEGMENTED
	if (document.status === schema.DOCUMENT_STATUS.CREATED) {
		// deleting existing sentences
		{
			const sentenceIds = sentences.map((s) => s.id);
			await Promise.all(chunk(sentenceIds, 10).map((sentenceIds) => env.VECTORIZE_MAIN_SENTENCES.deleteByIds(sentenceIds)));
			await dao.deleteSentences(document.id);
		}

		// segmenting sentences
		const sentenceContents = await invokeStanzaSentenceSegmentation(env, document.content);

		const sentencePartials = sentenceContents
			.map((content) => content.trim())
			.filter((content) => content)
			.map((content, i) => ({
				sequenceId: i,
				content,
			}))
			.concat([
				{
					sequenceId: -1,
					content: document.title,
				},
			]);

		// creating sentences
		sentences = flatten(await Promise.all(chunk(sentencePartials, 10).map((sentences) => dao.createSentences(document, sentences))));

		// update status
		await dao.updateDocumentStatus(documentId, schema.DOCUMENT_STATUS.SEGMENTED);
		document.status = schema.DOCUMENT_STATUS.SEGMENTED;
	}

	// SEGMENTED -> ANALYZED
	if (document.status === schema.DOCUMENT_STATUS.SEGMENTED) {
		const ai = new Ai(env.AI);

		await Promise.all(
			sentences
				.filter((s) => !s.isAnalyzed)
				.map(async (sentence) => {
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

					await dao.updateSentenceAnalyzed(sentence.id, true);
				})
		);

		await dao.updateDocumentStatus(documentId, schema.DOCUMENT_STATUS.ANALYZED);
		document.status = schema.DOCUMENT_STATUS.ANALYZED;
	}

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

	await env.QUEUE_MAIN_DOCUMENT_ANALYSIS.send({ documentId: document.id }, { contentType: 'json' });

	return { document };
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

	await dao.mustMembership(team.id, userId, schema.MEMBERSHIP_ROLE.ADMIN, schema.MEMBERSHIP_ROLE.MEMBER);

	await dao.deleteSentences(document.id);

	await dao.resetDocument(document.id, { title, content });

	await env.QUEUE_MAIN_DOCUMENT_ANALYSIS.send({ documentId: document.id }, { contentType: 'json' });

	return {
		document: Object.assign(document, {
			content,
			title,
			status: schema.DOCUMENT_STATUS.CREATED,
		}),
	};
};
