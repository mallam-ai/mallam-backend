import { ActionHandler } from '../types';
import { Ai } from '@cloudflare/ai';
import { datasets_vectorize_sentences_retrieve } from './datasets';

const MODEL_CHAT = '@cf/meta/llama-2-7b-chat-int8';

export const chat: ActionHandler = async (req, { text }) => {
	const { env } = req;
	const ai = new Ai(env.AI);

	const context = await datasets_vectorize_sentences_retrieve(req, { text });

	const contextLines: string[] = [];

	context.forEach(({ document, sentences }: {
		document: { content: string, title: string },
		sentences: { content: string }[]
	}) => {
		const content = sentences.map(s => s.content).join(' ');
		contextLines.push(`- Document '${document.title}': ${content}`);
	});

	const messages = [
		...(contextLines.length ? [{ role: 'system', content: 'Context:\n' + contextLines.join('\n') }] : []),
		{
			role: 'system',
			content: `When answering the question or responding, use the context provided, if it is provided and relevant.`
		},
		{ role: 'user', content: text }
	];

	const { response } = await ai.run(
		MODEL_CHAT,
		{
			messages
		}
	);

	return { response };
};
