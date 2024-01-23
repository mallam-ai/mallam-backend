import { DAO } from '../dao';
import { ActionHandler } from '../types';

export const chat_generation: ActionHandler = async ({ env }, { historyId }: { historyId: string }) => {};

export const chat_generation_failed: ActionHandler = async ({ env }, { historyId }: { historyId: string }) => {};

export const chat_create: ActionHandler = async (
	{ env },
	{ teamId, userId, title, system, content }: { teamId: string; userId: string; title: string; system: string; content: string }
) => {
	const dao = new DAO(env);

	await dao.mustTeam(teamId);

	await dao.mustMembership(teamId, userId);
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
