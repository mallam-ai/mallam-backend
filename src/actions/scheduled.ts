import { DAO } from '../dao';
import { ActionHandler } from '../types';

export const scheduled: ActionHandler = async ({ env }, {}) => {
	const dao = new DAO(env);

	// update analyzing documents
	const analyzingDocumentIds = await dao.getAnalyzingDocumentIds({ limit: 30 });
	await Promise.all(analyzingDocumentIds.map((documentId) => dao.updateDocumentAnalyzed(documentId)));
};
