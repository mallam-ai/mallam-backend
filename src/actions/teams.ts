import { ActionHandler } from '../types';
import * as schema from '../../schema-main';
import { drizzle } from 'drizzle-orm/d1';
import { sql, and, isNull, eq, inArray } from 'drizzle-orm';
import { halt } from '../utils';

const LIMIT_TEAM_PER_USER = 10;

export const team_list: ActionHandler = async function (
	{ env },
	{
		userId,
	}: {
		userId: string;
	}
) {
	const db = drizzle(env.DB_MAIN, { schema });

	// due to cloudflare D1 bug, we have to use this workaround
	const memberships = await db.query.tMemberships.findMany({
		where: eq(schema.tMemberships.userId, userId),
	});

	const teamIds = memberships.map((m) => m.teamId);

	const teams = await db.query.tTeams.findMany({
		where: and(inArray(schema.tTeams.id, teamIds), isNull(schema.tTeams.deletedAt)),
	});

	return {
		teams: teams.map((team) => {
			const membership = memberships.find((m) => m.teamId === team.id)!;
			return Object.assign({}, team, {
				membership: {
					id: membership.id,
					role: membership.role,
					createdBy: membership.createdBy,
					createdAt: membership.createdAt,
				},
			});
		}),
	};

	/*
	const teams = await db
		.select()
		.from(schema.tMemberships)
		.leftJoin(schema.tTeams, eq(schema.tTeams.id, schema.tMemberships.teamId))
		.leftJoin(schema.tUsers, eq(schema.tUsers.id, schema.tMemberships.userId))
		.where(and(eq(schema.tUsers.id, userId), isNull(schema.tTeams.deletedAt)))
		.all();

	return {
		teams,
	};
	*/
};

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

	const membership = (
		await db
			.insert(schema.tMemberships)
			.values({
				id: crypto.randomUUID(),
				userId,
				teamId: team.id,
				role: schema.membershipRoles.admin,
				createdBy: userId,
				createdAt: new Date(),
			})
			.returning()
	)[0];

	return {
		team,
		membership,
	};
};
