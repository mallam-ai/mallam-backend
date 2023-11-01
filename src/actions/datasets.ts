import { ActionHandler } from '../types';
import { drizzle } from 'drizzle-orm/d1';
import { tDocuments, tSentences } from '../../schema';
import { eq } from 'drizzle-orm';
import { Ai } from '@cloudflare/ai';

type DocumentPayload = {
	id: string
	author: string
	vendor: string
	url: string
	title: string
	content: string
	sentences: string[]
}

export const datasets_document_upsert: ActionHandler = async (
	{ env },
	{ id, author, vendor, url, title, content, sentences }: DocumentPayload
) => {
	const db = drizzle(env.DB_DATASETS);
	// upsert document
	await db.insert(tDocuments).values({
		id, author, vendor, url, title, content
	}).onConflictDoUpdate({
		target: tDocuments.id,
		set: { author, vendor, url, title, content }
	});
	// delete old sentences
	await db.delete(tSentences).where(eq(tSentences.documentId, id));
	// insert new sentences
	await db.insert(tSentences).values(
		sentences.map((sentence, position) => ({
			id: `${id}-${position}`,
			documentId: id,
			position: position,
			content: sentence
		}))
	);
	// invoke vectorize action
	await env.QUEUE_DATASETS_VECTORIZE_SENTENCE_UPSERT.sendBatch(
		sentences.map((sentence, position) => ({
			body: {
				sentenceId: `${id}-${position}`
			},
			contentType: 'json'
		}))
	);
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
			documentId: sentence.documentId,
			position: sentence.position
		}
	}]);
};
