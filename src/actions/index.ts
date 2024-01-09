import { ActionHandler } from '../types';
import { datasets_document_upsert, datasets_vectorize_sentences_retrieve, datasets_vectorize_sentences_upsert } from './datasets';
import { oauth_authorize_user, oauth_create_authorization_uri } from './auth';
import { user_get } from './users';
import { team_create, team_list } from './teams';
import { chat } from './chat';
import { ping } from './ping';

const ACTIONS = {
	ping,
	datasets_document_upsert,
	datasets_vectorize_sentences_upsert,
	datasets_vectorize_sentences_retrieve,
	chat,
	oauth_create_authorization_uri,
	oauth_authorize_user,
	user_get,
	team_create,
	team_list,
	// queues
	'queue-mallam-datasets-vectorize-sentences-upsert': datasets_vectorize_sentences_upsert,
};

/**
 * get a action handler by name
 * @param action action name
 * @returns ActionHandler or undefined
 */
export function getActionHandler(action: string): ActionHandler | undefined {
	return (ACTIONS as Record<string, ActionHandler>)[action];
}
