import { ActionHandler } from '../types';
import * as schema from '../../schema-main';
import { drizzle } from 'drizzle-orm/d1';
import { sql, and, isNull, eq, inArray } from 'drizzle-orm';
import { halt } from '../utils';

export const membership_add: ActionHandler = async function (
	{ env },
	{
		userId,
		teamId,
		role,
		targetUserId,
	}: {
		userId: string;
		teamId: string;
		role: string;
		targetUserId: string;
	}
) {
	if (targetUserId === userId) {
		halt(`cannot add yourself`, 403);
	}

	if ([schema.membershipRoles.member, schema.membershipRoles.viewer].indexOf(role) === -1) {
		halt(`invalid role ${role}`, 400);
	}

	const db = drizzle(env.DB_MAIN, { schema });

	const team = await db.query.tTeams.findFirst({ where: and(eq(schema.tTeams.id, teamId), isNull(schema.tTeams.deletedAt)) });

	if (!team) {
		halt(`team ${teamId} not found`, 404);
	}

	{
		const membership = await db.query.tMemberships.findFirst({
			where: and(
				eq(schema.tMemberships.userId, userId),
				eq(schema.tMemberships.teamId, teamId),
				eq(schema.tMemberships.role, schema.membershipRoles.admin)
			),
		});

		if (!membership) {
			halt(`user ${userId} is not an admin of team ${teamId}`, 403);
		}
	}

	const targetUser = await db.query.tUsers.findFirst({ where: eq(schema.tUsers.id, targetUserId) });

	if (!targetUser) {
		halt(`user ${targetUserId} not found`, 404);
	}

	const membership = await db
		.insert(schema.tMemberships)
		.values({
			id: crypto.randomUUID(),
			userId: targetUserId,
			teamId: teamId,
			role: role,
			createdAt: new Date(),
			createdBy: userId,
		})
		.onConflictDoUpdate({
			target: [schema.tMemberships.userId, schema.tMemberships.teamId],
			set: { role: role },
		})
		.returning();

	return { membership };
};

export const membership_remove: ActionHandler = async function (
	{ env },
	{
		userId,
		teamId,
		targetUserId,
	}: {
		userId: string;
		teamId: string;
		targetUserId: string;
	}
) {
	if (targetUserId === userId) {
		halt(`cannot remove yourself`, 403);
	}

	const db = drizzle(env.DB_MAIN, { schema });

	const team = await db.query.tTeams.findFirst({ where: and(eq(schema.tTeams.id, teamId), isNull(schema.tTeams.deletedAt)) });

	if (!team) {
		halt(`team ${teamId} not found`, 404);
	}

	const membership = await db.query.tMemberships.findFirst({
		where: and(
			eq(schema.tMemberships.userId, userId),
			eq(schema.tMemberships.teamId, teamId),
			eq(schema.tMemberships.role, schema.membershipRoles.admin)
		),
	});

	if (!membership) {
		halt(`user ${userId} is not an admin of team ${teamId}`, 403);
	}

	await db.delete(schema.tMemberships).where(and(eq(schema.tMemberships.userId, targetUserId), eq(schema.tMemberships.teamId, teamId)));

	return {};
};

export const membership_list: ActionHandler = async function (
	{ env },
	{
		userId,
		teamId,
	}: {
		userId: string;
		teamId: string;
	}
) {
	const db = drizzle(env.DB_MAIN, { schema });

	const team = await db.query.tTeams.findFirst({ where: and(eq(schema.tTeams.id, teamId), isNull(schema.tTeams.deletedAt)) });

	if (!team) {
		halt(`team ${teamId} not found`, 404);
	}

	const membership = await db.query.tMemberships.findFirst({
		where: and(
			eq(schema.tMemberships.userId, userId),
			eq(schema.tMemberships.teamId, teamId),
			inArray(schema.tMemberships.role, [schema.membershipRoles.admin, schema.membershipRoles.member, schema.membershipRoles.viewer])
		),
	});

	if (!membership) {
		halt(`user ${userId} is not a member or admin of team ${teamId}`, 403);
	}

	const memberships = await db.query.tMemberships.findMany({ where: eq(schema.tMemberships.teamId, teamId) });

	const membershipUserIds = memberships.map((m) => m.userId);

	const users = await db.query.tUsers.findMany({ where: inArray(schema.tUsers.id, membershipUserIds) });

	return {
		memberships: memberships.map((m) => {
			const user = users.find((u) => u.id === m.userId)!;
			return Object.assign(
				{},
				m,
				user
					? {
							userVendor: user.vendor,
							userVendorUserId: user.vendorUserId,
							userDisplayName: user.displayName,
							userCreatedAt: user.createdAt,
					  }
					: {}
			);
		}),
	};
};
