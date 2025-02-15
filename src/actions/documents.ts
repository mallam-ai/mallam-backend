import { ActionHandler } from '../types';
import * as schema from '../../schema-main';
import { invokeStanzaSentenceSegmentation } from '../utils';
import { chunk, flatten } from 'lodash';
import { DAO } from '../dao';

const MODEL_EMBEDDINGS = '@cf/baai/bge-base-en-v1.5';

const SEARCH_SIMILARITY_CUTOFF = 0.75;
const SEARCH_TOP_K = 5;
const SEARCH_CONTEXT_SIZE = 2;

export const document_retry_failed: ActionHandler = async function (
	{ env },
	{
		teamId,
		userId,
	}: {
		teamId: string;
		userId: string;
	}
) {
	const dao = new DAO(env);
	const team = await dao.mustTeam(teamId);
	await dao.mustMembership(team.id, userId, schema.MEMBERSHIP_ROLE.ADMIN, schema.MEMBERSHIP_ROLE.MEMBER);
	const documents = await dao.listDocumentsFailedToAnalyze(teamId);
	const documentIds = documents.map((d) => d.id);

	await Promise.all(
		chunk(documents).map(async (documents) => {
			await dao.updateDocumentsStatus(documentIds, schema.DOCUMENT_STATUS.CREATED);
			await env.QUEUE_MAIN_DOCUMENT_ANALYSIS.sendBatch(
				documentIds.map((id) => ({
					body: {
						documentId: id,
					},
					contentType: 'json',
				}))
			);
		})
	);

	return {};
};

export const document_search: ActionHandler = async function (
	{ env },
	{
		teamId,
		userId,
		content,
	}: {
		teamId: string;
		userId: string;
		content: string;
	}
) {
	const dao = new DAO(env);
	const team = await dao.mustTeam(teamId);
	await dao.mustMembership(team.id, userId);

	const ai = env.AI;
	const { data } = await ai.run(MODEL_EMBEDDINGS, { text: [content] });
	if (!data) {
		throw new Error('Failed to search');
	}

	const query = await env.VECTORIZE_MAIN_SENTENCES.query(data[0], {
		namespace: teamId,
		topK: SEARCH_TOP_K,
	});

	const sentencesIds = query.matches
		.filter((vec) => vec.score > SEARCH_SIMILARITY_CUTOFF)
		.sort((a, b) => b.score - a.score)
		.map((vec) => vec.id || ((vec as any).vectorId as string));

	if (sentencesIds.length === 0) {
		return { documents: [] };
	}

	return {
		documents: await dao.listDocumentsWithSentenceIds(sentencesIds, { contextSize: SEARCH_CONTEXT_SIZE }),
	};
};

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
			sentences,
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
		const ai = env.AI;

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
