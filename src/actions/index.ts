import { ActionHandler } from '../types';
import { vectorize_sentence } from './vectorize';

const ACTIONS = {
	vectorize_sentence,

	// queues
	'queue-mallam-vectorize-sentence': vectorize_sentence,
};

/**
 * get a action handler by name
 * @param action action name
 * @returns ActionHandler or undefined
 */
export function getActionHandler(action: string): ActionHandler | undefined {
	return (ACTIONS as Record<string, ActionHandler>)[action];
}
