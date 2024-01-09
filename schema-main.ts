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
