import { index, uniqueIndex, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const tUsers = sqliteTable(
	'users',
	{
		// unique id for user
		id: text('id').primaryKey(),
		// authentication source, 'github' for example
		source: text('source').notNull(),
		// authentication source user id, '112233' for example
		sourceUserId: text('source_user_id').notNull(),
		// display name for user
		displayName: text('display_name').notNull(),
		// createdAt
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(users) => ({
		idx_users_source: index('idx_users_source').on(users.source),
		idx_users_source_user_id: index('idx_users_source_user_id').on(users.sourceUserId),
		idx_users_unique_source_with_id: uniqueIndex('idx_users_unique_source_with_id').on(users.source, users.sourceUserId),
		idx_users_created_at: index('idx_users_created_at').on(users.createdAt),
	})
);
