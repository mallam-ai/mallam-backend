import { ActionHandler } from '../types';
import * as schema from '../../schema-main';
import { drizzle } from 'drizzle-orm/d1';
import { sql, and, isNull, eq, inArray } from 'drizzle-orm';
import { halt } from '../utils';

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
