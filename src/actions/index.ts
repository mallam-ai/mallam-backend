import { ActionHandler } from '../types';

const ACTIONS = {};

/**
 * get a action handler by name
 * @param action action name
 * @returns ActionHandler or undefined
 */
export function getActionHandler(action: string): ActionHandler | undefined {
	return (ACTIONS as Record<string, ActionHandler>)[action];
}
