import { ActionHandler } from '../types';
import { datasets_document_upsert, datasets_vectorize_sentences_retrieve, datasets_vectorize_sentences_upsert } from './datasets';
import { oauth_authorize_user, oauth_create_authorization_uri } from './auth';
import { user_get } from './users';
import { team_create, team_list, team_get, team_delete, team_update, team_leave } from './teams';
import { chat } from './chat';
import { ping } from './ping';
import { membership_list, membership_remove, membership_add } from './memberships';
import {
	document_get,
	document_create,
	document_list,
	document_analyze,
	sentence_analyze,
	document_update,
	document_delete,
} from './documents';
import { scheduled } from './scheduled';

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
	team_get,
	team_update,
	team_delete,
	team_leave,
	membership_add,
	membership_create: membership_add,
	membership_list,
	membership_remove,
	document_get,
	document_create,
	document_list,
	document_update,
	document_delete,
	// scheduled
	scheduled,
	// queues
	'queue-mallam-datasets-vectorize-sentences-upsert': datasets_vectorize_sentences_upsert,
	'queue-mallam-main-document-analyze': document_analyze,
	'queue-mallam-main-sentence-analyze': sentence_analyze,
};

/**
 * get a action handler by name
 * @param action action name
 * @returns ActionHandler or undefined
 */
export function getActionHandler(action: string): ActionHandler | undefined {
	return (ACTIONS as Record<string, ActionHandler>)[action];
}
