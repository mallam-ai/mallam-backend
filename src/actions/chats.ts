import { DAO } from '../dao';
import { ActionHandler } from '../types';

export const chats_list: ActionHandler = async (
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
