import { DAO } from '../dao';
import * as schema from '../../schema-main';
import { ActionHandler } from '../types';
import { Ai } from '@cloudflare/ai';
import { halt } from '../utils';

const MODEL_GENERATION = '@cf/meta/llama-2-7b-chat-fp16';

export const history_regenerate: ActionHandler = async ({ env }, { historyId }: { historyId: string }) => {
	const dao = new DAO(env);

	const history = await dao.mustHistory(historyId);

	if (history.status === schema.HISTORY_STATUS.GENERATING) {
		return;
	}

	await dao.updateHistoryStatus(historyId, schema.HISTORY_STATUS.PENDING);

	await env.QUEUE_MAIN_CHAT_GENERATION.send({ historyId }, { contentType: 'json' });

	return {};
};

export const chat_input: ActionHandler = async (
	{ env },
	{ chatId, userId, content }: { chatId: string; userId: string; content: string }
) => {
	const dao = new DAO(env);

	const chat = await dao.mustChat(chatId);

	if (chat.userId !== userId) {
		halt('You are not allowed to input to this chat');
		return;
	}

	const team = await dao.mustTeam(chat.teamId);
	await dao.mustMembership(team.id, userId);

	const { assistantHistoryId } = await dao.inputChat(chat, content);

	await env.QUEUE_MAIN_CHAT_GENERATION.send({ historyId: assistantHistoryId }, { contentType: 'json' });

	return { chat };
};

export const chat_generation: ActionHandler = async ({ env, ctx }, { historyId }: { historyId: string }) => {
	const dao = new DAO(env);
	const ai = new Ai(env.AI, { sessionOptions: { ctx } });

	const history = await dao.mustHistory(historyId);

	await dao.updateHistoryStatus(historyId, schema.HISTORY_STATUS.GENERATING);

	const histories = await dao.listHistoriesBefore(history.chatId, history);

	// use stream and convert to text to get a higher tokens limit
	const stream: ReadableStream<Uint8Array> = await ai.run(MODEL_GENERATION, {
		messages: histories.map((h) => ({ role: h.role, content: h.content })),
		stream: true,
	});
	const response = new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
	const events = await response.text();

	let content = '';

	events.split('\n').forEach((line) => {
		line = line.trim();
		// remove data: prefix
		if (!line.startsWith('data:')) {
			return;
		}
		line = line.substring(5).trim();
		// must be a json
		if (!line.startsWith('{') || !line.endsWith('}')) {
			return;
		}
		try {
			const body = JSON.parse(line);
			if (typeof body.response === 'string') {
				content += body.response;
			}
		} catch (_) {}
	});

	await dao.updateHistoryGeneratedContent(historyId, content);
};

export const chat_generation_failed: ActionHandler = async ({ env }, { historyId }: { historyId: string }) => {
	const dao = new DAO(env);

	await dao.updateHistoryStatus(historyId, schema.HISTORY_STATUS.FAILED);
};

export const chat_get: ActionHandler = async ({ env }, { chatId, userId }: { chatId: string; userId: string }) => {
	const dao = new DAO(env);

	const chat = await dao.mustChat(chatId);

	if (chat.userId !== userId) {
		halt('You are not allowed to get this chat');
		return;
	}

	const histories = await dao.listHistories(chatId);

	return { chat: Object.assign(chat, { histories }) };
};

export const chat_delete: ActionHandler = async ({ env }, { chatId, userId }: { chatId: string; userId: string }) => {
	const dao = new DAO(env);

	const chat = await dao.mustChat(chatId);

	if (chat.userId !== userId) {
		halt('You are not allowed to get this chat');
		return;
	}

	await dao.deleteChat(chatId);

	return {};
};

export const chat_create: ActionHandler = async (
	{ env },
	{ teamId, userId, title, context, content }: { teamId: string; userId: string; title: string; context: string; content: string }
) => {
	const dao = new DAO(env);

	await dao.mustTeam(teamId);

	await dao.mustMembership(teamId, userId);

	const { chat, assistantHistoryId } = await dao.createChat({ teamId, userId, title, context, content });

	await env.QUEUE_MAIN_CHAT_GENERATION.send({ historyId: assistantHistoryId }, { contentType: 'json' });

	return { chat };
};

export const chat_list: ActionHandler = async (
	{ env },
	{
		teamId,
		userId,
		offset,
		limit,
	}: {
		teamId: string;
		userId: string;
		offset: number;
		limit: number;
	}
) => {
	const dao = new DAO(env);

	await dao.mustTeam(teamId);

	await dao.mustMembership(teamId, userId);

	return {
		offset,
		limit,
		total: await dao.countChats(teamId, userId),
		chats: await dao.listChats(teamId, userId, { offset, limit }),
	};
};
