import { ActionHandler } from '../types';
import { oauth_authorize_user, oauth_create_authorization_uri } from './auth';
import { user_get } from './users';
import { team_create, team_list, team_get, team_delete, team_update, team_leave } from './teams';
import { ping } from './ping';
import { membership_list, membership_remove, membership_add } from './memberships';
import {
	document_get,
	document_create,
	document_list,
	document_update,
	document_delete,
	document_analysis,
	document_analysis_failed,
	document_search,
	document_retry_failed,
} from './documents';
import { scheduled } from './scheduled';
import { chats_list } from './chats';

const ACTIONS = {
	ping,
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
	document_search,
	document_retry_failed,
	chats_list,
	// scheduled
	scheduled,
	'queue-mallam-main-document-analysis': document_analysis,
	'queue-mallam-main-document-analysis-failed': document_analysis_failed,
};

/**
 * get a action handler by name
 * @param action action name
 * @returns ActionHandler or undefined
 */
export function getActionHandler(action: string): ActionHandler | undefined {
	return (ACTIONS as Record<string, ActionHandler>)[action];
}
