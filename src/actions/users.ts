import { ActionHandler } from '../types';
import { DAO } from '../dao';

export const user_get: ActionHandler = async function ({ env }, { id, userId }) {
	const dao = new DAO(env);
	const user = await dao.mustUser(userId || id);
	return { user };
};
