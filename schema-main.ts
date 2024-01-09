import { index, uniqueIndex, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const tUsers = sqliteTable(
	'users',
	{
		// unique id for user
		id: text('id').primaryKey(),
		// authentication vendor, 'github' for example
		vendor: text('vendor').notNull(),
		// authentication vendor user id, '112233' for example
		vendorUserId: text('vendor_user_id').notNull(),
		// display name for user
		displayName: text('display_name').notNull(),
		// createdAt
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(users) => ({
		idx_users_vendor: index('idx_users_vendor').on(users.vendor),
		idx_users_vendor_user_id: index('idx_users_vendor_user_id').on(users.vendorUserId),
		idx_users_unique_vendor_with_id: uniqueIndex('idx_users_unique_vendor_with_id').on(users.vendor, users.vendorUserId),
		idx_users_created_at: index('idx_users_created_at').on(users.createdAt),
	})
);

export const tTeams = sqliteTable(
	'teams',
	{
		// unique id for user
		id: text('id').primaryKey(),
		// display name
		displayName: text('display_name').notNull(),
		// createdAt
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		// deletedAt
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
	},
	(teams) => ({
		idx_teams_created_at: index('idx_teams_created_at').on(teams.createdAt),
		idx_teams_deleted_at: index('idx_teams_deleted_at').on(teams.deletedAt),
	})
);

export const membershipRoles = {
	admin: 'admin',
	member: 'member',
	viewer: 'viewer',
};

export const tMemberships = sqliteTable(
	'memberships',
	{
		// unique id for user
		id: text('id').primaryKey(),
		// user id
		userId: text('user_id').notNull(),
		// team id
		teamId: text('team_id').notNull(),
		// created by
		createdBy: text('created_by').notNull(),
		// createdAt
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		// role
		role: text('role').notNull(),
	},
	(memberships) => ({
		idx_memberships_user_id: index('idx_memberships_user_id').on(memberships.userId),
		idx_memberships_team_id: index('idx_memberships_team_id').on(memberships.teamId),
		idx_memberships_created_by: index('idx_memberships_created_by').on(memberships.createdBy),
		idx_memberships_created_at: index('idx_memberships_created_at').on(memberships.createdAt),
		idx_memberships_unique_user_with_team: uniqueIndex('idx_memberships_unique_user_with_team').on(memberships.userId, memberships.teamId),
		idx_memberships_role: index('idx_memberships_role').on(memberships.role),
	})
);
