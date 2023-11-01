import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const tDocuments = sqliteTable(
	'documents',
	{
		// unique id for document
		id: text('id').primaryKey(),
		// vendor for document, ['marxists.org']
		vendor: text('vendor').notNull(),
		// author for document, ['marx']
		author: text('author').notNull(),
		// url of document
		url: text('url').notNull(),
		// title of document
		title: text('title').notNull(),
		// content of document
		content: text('content').notNull()
	},
	(documents) => ({
		idx_vendor: index('idx_documents_vendor').on(documents.vendor),
		idx_author: index('idx_documents_author').on(documents.author),
		idx_url: index('idx_documents_url').on(documents.url)
	})
);

export const tSentences = sqliteTable(
	'sentences',
	{
		// unique id for sentence
		id: text('id').primaryKey(),
		// index of sentence in document, starting from 0
		position: integer('position').notNull(),
		// document id
		documentId: text('document_id')
			.notNull()
			.references(() => tDocuments.id),
		// content of sentences
		content: text('content').notNull()
	},
	(sentences) => ({
		idx_position: index('idx_sentences_position').on(sentences.position),
		idx_document_id: index('idx_sentences_document_id').on(sentences.documentId)
	})
);
