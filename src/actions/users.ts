import { drizzle } from 'drizzle-orm/d1';
import { ActionHandler } from '../types';
import * as schema from '../../schema-main';
import { halt } from '../utils';

export const user_get: ActionHandler = async function ({ env }, { id }) {
	const db = drizzle(env.DB_MAIN, { schema });
	const user = await db.query.tUsers.findFirst({ where: (users, { eq }) => eq(users.id, id) });
	if (!user) {
		halt('user not found', 400);
	}
	return { user };
};
