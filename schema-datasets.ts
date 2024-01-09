import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const tDocuments = sqliteTable(
	'documents',
	{
		// unique id for document
		id: text('id').primaryKey(),
		// repo name
		repo: text('repo').notNull(),
		// url of document
		url: text('url').notNull(),
		// title of document
		title: text('title').notNull(),
		// content of document
		content: text('content').notNull()
	},
	(documents) => ({
		idx_repo: index('idx_documents_repo').on(documents.repo),
		idx_url: index('idx_documents_url').on(documents.url)
	})
);

export const tSentences = sqliteTable(
	'sentences',
	{
		// unique id for sentence
		id: text('id').primaryKey(),
		// repo name
		repo: text('repo').notNull(),
		// index of sentence in document, starting from 0
		position: integer('position').notNull(),
		// document id
		documentId: text('document_id')
			.notNull()
			.references(() => tDocuments.id),
		// content of sentences
		content: text('content').notNull(),
		// status of vectorize
		status: integer('status').notNull().default(0)
	},
	(sentences) => ({
		idx_repo: index('idx_sentences_repo').on(sentences.repo),
		idx_document_id: index('idx_sentences_document_id').on(sentences.documentId),
		idx_position: index('idx_sentences_position').on(sentences.position),
		idx_status: index('idx_sentences_status').on(sentences.status)
	})
);
