import { chunk } from 'lodash';
import { DAO } from '../dao';
import { ActionHandler } from '../types';

export const scheduled: ActionHandler = async ({ env }, {}) => {
	const dao = new DAO(env);

	// reanalyze sentences
	const analyzingSentenceIds = await dao.getAnalyzingSentenceIds({ limit: 30 });
	await Promise.all(
		chunk(analyzingSentenceIds, 10).map(async (sentenceIds) =>
			env.QUEUE_MAIN_SENTENCE_ANALYZE.sendBatch(sentenceIds.map((sentenceId) => ({ body: { sentenceId }, contentType: 'json' })))
		)
	);

	// update analyzing documents
	const analyzingDocumentIds = await dao.getAnalyzingDocumentIds({ limit: 30 });
	await Promise.all(analyzingDocumentIds.map((documentId) => dao.updateDocumentAnalyzed(documentId)));
};
