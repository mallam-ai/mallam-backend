import { ActionHandler } from '../types';
import * as schema from '../../schema-main';
import { halt } from '../utils';
import { DAO } from '../dao';

export const membership_add: ActionHandler = async function (
	{ env },
	{
		userId,
		teamId,
		role,
		targetUserId,
	}: {
		userId: string;
		teamId: string;
		role: string;
		targetUserId: string;
	}
) {
	if (targetUserId === userId) {
		halt(`cannot add yourself`, 403);
	}

	if ([schema.membershipRoles.member, schema.membershipRoles.viewer].indexOf(role) === -1) {
		halt(`invalid role ${role}`, 400);
	}

	const dao = new DAO(env);

	await dao.mustTeam(teamId);

	await dao.mustMembership(teamId, userId, schema.membershipRoles.admin);

	await dao.mustUser(targetUserId);

	const membership = await dao.upsertMembership(teamId, targetUserId, role);

	return { membership };
};

export const membership_remove: ActionHandler = async function (
	{ env },
	{
		userId,
		teamId,
		targetUserId,
	}: {
		userId: string;
		teamId: string;
		targetUserId: string;
	}
) {
	if (targetUserId === userId) {
		halt(`cannot remove yourself`, 403);
	}

	const dao = new DAO(env);

	await dao.mustTeam(teamId);

	await dao.mustMembership(teamId, userId, schema.membershipRoles.admin);

	await dao.deleteMembership(teamId, targetUserId);

	return {};
};

export const membership_list: ActionHandler = async function (
	{ env },
	{
		userId,
		teamId,
	}: {
		userId: string;
		teamId: string;
	}
) {
	const dao = new DAO(env);

	await dao.mustTeam(teamId);

	await dao.mustMembership(teamId, userId, schema.membershipRoles.admin, schema.membershipRoles.member, schema.membershipRoles.viewer);

	const memberships = await dao.listMembershipWithUser(teamId);

	return { memberships };
};
