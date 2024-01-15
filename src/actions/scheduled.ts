import { chunk } from 'lodash';
import { DAO } from '../dao';
import { ActionHandler } from '../types';

export const scheduled: ActionHandler = async ({ env }, {}) => {
	/*
	const dao = new DAO(env);

	// re-analyze sentences
	const ANALYSIS_STARTEDSentenceIds = await dao.getAnalyzingSentenceIds({ limit: 30 });
	await Promise.all(
		chunk(ANALYSIS_STARTEDSentenceIds, 10).map(async (sentenceIds) =>
			env.QUEUE_MAIN_SENTENCE_ANALYZE.sendBatch(sentenceIds.map((sentenceId) => ({ body: { sentenceId }, contentType: 'json' })))
		)
	);

	// update document isAnalyzed
	const ANALYSIS_STARTEDDocumentIds = await dao.getAnalyzingDocumentIds({ limit: 30 });
	await Promise.all(ANALYSIS_STARTEDDocumentIds.map((documentId) => dao.updateDocumentAnalyzed(documentId)));
	*/
};
