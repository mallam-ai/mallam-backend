import { ActionHandler } from '../types';
import { datasets_document_upsert, datasets_vectorize_sentences_upsert } from './datasets';

const ACTIONS = {
	datasets_document_upsert,
	datasets_vectorize_sentences_upsert,
	// queues
	'queue-mallam-datasets-vectorize-sentences-upsert': datasets_vectorize_sentences_upsert
};

/**
 * get a action handler by name
 * @param action action name
 * @returns ActionHandler or undefined
 */
export function getActionHandler(action: string): ActionHandler | undefined {
	return (ACTIONS as Record<string, ActionHandler>)[action];
}
