import { ActionHandler } from '../types';
import * as schema from '../../schema-main';
import { drizzle } from 'drizzle-orm/d1';
import { sql, and, isNull, eq } from 'drizzle-orm';
import { halt } from '../utils';

const LIMIT_TEAM_PER_USER = 10;

export const team_create: ActionHandler = async function (
	{ env },
	{
		displayName,
		userId,
	}: {
		displayName: string;
		userId: string;
	}
) {
	const db = drizzle(env.DB_MAIN, { schema });

	// validate max team per user
	{
		const count = (
			await db
				.select({ value: sql<number>`count(${schema.tTeams.id})` })
				.from(schema.tTeams)
				.where(and(eq(schema.tTeams.createdBy, userId), isNull(schema.tTeams.deletedAt)))
		)[0];

		if (count.value > LIMIT_TEAM_PER_USER) {
			halt(`user ${userId} has reached the limit of ${LIMIT_TEAM_PER_USER} teams`, 400);
		}
	}

	const team = (
		await db
			.insert(schema.tTeams)
			.values({
				id: crypto.randomUUID(),
				displayName,
				createdBy: userId,
				createdAt: new Date(),
			})
			.returning()
	)[0];

	const membership = await db
		.insert(schema.tMemberships)
		.values({
			id: crypto.randomUUID(),
			userId,
			teamId: team.id,
			role: schema.membershipRoles.admin,
			createdBy: userId,
			createdAt: new Date(),
		})
		.returning();

	return {
		team,
		membership,
	};
};
