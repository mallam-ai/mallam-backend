import { ActionHandler } from '../types';
import { drizzle } from 'drizzle-orm/d1';
import { tDocuments, tSentences } from '../../schema';
import { eq } from 'drizzle-orm';
import { Ai } from '@cloudflare/ai';
import { chunk } from 'lodash';

type DocumentPayload = {
	id: string
	repo: string
	url: string
	title: string
	content: string
	sentences: string[]
}

export const datasets_document_upsert: ActionHandler = async (
	{ env },
	{ id, repo, url, title, content, sentences: _sentences }: DocumentPayload
) => {
	const db = drizzle(env.DB_DATASETS);

	// upsert document
	await db.insert(tDocuments).values({
		id, repo, url, title, content
	}).onConflictDoUpdate({
		target: tDocuments.id,
		set: { repo, url, title, content }
	});

	// delete old sentences
	await db.delete(tSentences).where(eq(tSentences.documentId, id));

	// prepare sentences
	const sentences = _sentences.map((sentence, position) => ({
		id: `${id}-${position}`,
		repo,
		documentId: id,
		position: position,
		content: sentence,
		status: 0
	}));

	// insert sentences
	await Promise.all(
		chunk(sentences, 10).map(sentences => db.insert(tSentences).values(sentences))
	);

	// invoke vectorize action
	await Promise.all(
		chunk(sentences, 10).map(sentences => env.QUEUE_DATASETS_VECTORIZE_SENTENCE_UPSERT.sendBatch(
			sentences.map(record => ({ body: { sentenceId: record.id }, contentType: 'json' }))
		))
	);

	return {
		success: true,
		document: {
			id
		},
		sentences: sentences.map(({ id }) => ({ id }))
	};
};

const MODEL_EMBEDDINGS = '@cf/baai/bge-base-en-v1.5';

export const datasets_vectorize_sentence_upsert: ActionHandler = async ({ env }, { sentenceId }) => {
	const db = drizzle(env.DB_DATASETS, { schema: { tDocuments, tSentences } });
	// fetch sentence
	const sentence = await db.query.tSentences.findFirst({
		where: eq(tSentences.id, sentenceId)
	});
	if (!sentence) {
		throw new Error(`Sentence ${sentenceId} not found`);
	}
	if (!sentence.content) {
		console.log(`Sentence ${sentenceId} has no content`);
		return;
	}
	// vectorize sentence
	const ai = new Ai(env.AI);
	const { data } = await ai.run(MODEL_EMBEDDINGS, { text: [sentence.content] });
	const values = data[0];
	if (!values) {
		throw new Error(`Failed to vectorize sentence ${sentenceId}`);
	}
	// upsert sentence
	await env.VECTORIZE_DATASETS_SENTENCES.upsert([{
		id: sentenceId,
		values,
		metadata: {
			repo: sentence.repo,
			documentId: sentence.documentId,
			position: sentence.position
		}
	}]);
	// update status
	await db.update(tSentences).set({
		status: 1
	}).where(eq(tSentences.id, sentenceId));

	return { success: true };
};
