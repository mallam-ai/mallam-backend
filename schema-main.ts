import { relations } from 'drizzle-orm';
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
		// created by
		createdBy: text('created_by').notNull(),
		// createdAt
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		// deletedAt
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
	},
	(teams) => ({
		idx_teams_created_by: index('idx_teams_created_by').on(teams.createdBy),
		idx_teams_created_at: index('idx_teams_created_at').on(teams.createdAt),
		idx_teams_deleted_at: index('idx_teams_deleted_at').on(teams.deletedAt),
	})
);

export const MEMBERSHIP_ROLE = {
	ADMIN: 'admin',
	MEMBER: 'member',
	VIEWER: 'viewer',
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

export const rMembershipsToUser = relations(tUsers, ({ many }) => ({
	memberships: many(tMemberships),
}));

export const rMembershipsToTeam = relations(tTeams, ({ many }) => ({
	memberships: many(tMemberships),
}));

export const rMemberships = relations(tMemberships, ({ one }) => ({
	user: one(tUsers, {
		fields: [tMemberships.userId],
		references: [tUsers.id],
	}),
	team: one(tTeams, {
		fields: [tMemberships.teamId],
		references: [tTeams.id],
	}),
}));

export const DOCUMENT_STATUS = {
	CREATED: 0,
	ANALYZING: 1,
	ANALYZED: 2,
};

export const tDocuments = sqliteTable(
	'documents',
	{
		// unique id for document
		id: text('id').primaryKey(),
		// repo name
		teamId: text('team_id').notNull(),
		// public
		isPublic: integer('is_public', { mode: 'boolean' }).notNull(),
		// analyzied
		isAnalyzed: integer('is_analyzed', { mode: 'boolean' }).notNull().default(false),
		// status
		status: integer('status').notNull().default(0),
		// title of document
		title: text('title').notNull(),
		// content of document
		content: text('content').notNull(),
		// created by
		createdBy: text('created_by').notNull(),
		// created at
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		// deletedAt
		deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
	},
	(documents) => ({
		idx_documents_team_id: index('idx_documents_team_id').on(documents.teamId),
		idx_documents_is_public: index('idx_documents_is_public').on(documents.isPublic),
		idx_documents_status: index('idx_documents_status').on(documents.status),
		idx_documents_created_by: index('idx_documents_created_by').on(documents.createdBy),
		idx_documents_created_at: index('idx_documents_created_at').on(documents.createdAt),
		idx_documents_deleted_at: index('idx_documents_deleted_at').on(documents.deletedAt),
	})
);

export const tSentences = sqliteTable(
	'sentences',
	{
		// unique id for document, in format of 'documentId#sequenceId'
		id: text('id').primaryKey(),
		// repo name
		teamId: text('team_id').notNull(),
		// document id
		documentId: text('document_id').notNull(),
		// sequence id, from 0 to n, -1 for title
		sequenceId: integer('sequence_id').notNull(),
		// analyzied
		isAnalyzed: integer('is_analyzed', { mode: 'boolean' }).notNull().default(false),
		// content of document
		content: text('content').notNull(),
		// created by
		createdBy: text('created_by').notNull(),
		// created at
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	},
	(sentences) => ({
		idx_sentences_team_id: index('idx_sentences_team_id').on(sentences.teamId),
		idx_sentences_document_id: index('idx_sentences_document_id').on(sentences.documentId),
		idx_sentences_sequence_id: index('idx_sentences_sequence_id').on(sentences.sequenceId),
		idx_sentences_unique_document_sentence_id: uniqueIndex('idx_sentences_unique_document_sentence_id').on(
			sentences.documentId,
			sentences.sequenceId
		),
		idx_sentences_created_by: index('idx_sentences_created_by').on(sentences.createdBy),
		idx_sentences_created_at: index('idx_sentences_created_at').on(sentences.createdAt),
	})
);

export const rSentencesToDocument = relations(tDocuments, ({ many }) => ({
	sentences: many(tSentences),
}));

export const rSentencesToTeam = relations(tTeams, ({ many }) => ({
	sentences: many(tSentences),
}));

export const rDocumentToSentence = relations(tSentences, ({ one }) => ({
	document: one(tDocuments, {
		fields: [tSentences.documentId],
		references: [tDocuments.id],
	}),
}));

export const rTeamToSentence = relations(tSentences, ({ one }) => ({
	team: one(tTeams, {
		fields: [tSentences.teamId],
		references: [tTeams.id],
	}),
}));

export const rDocumentsToTeam = relations(tTeams, ({ many }) => ({
	documents: many(tDocuments),
}));

export const rTeamToDocuments = relations(tDocuments, ({ one }) => ({
	team: one(tTeams, {
		fields: [tDocuments.teamId],
		references: [tTeams.id],
	}),
}));
