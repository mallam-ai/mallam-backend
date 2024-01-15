import { ActionHandler } from '../types';
import * as schema from '../../schema-main';
import { halt } from '../utils';
import { DAO } from '../dao';

const LIMIT_TEAM_PER_USER = 10;

export const team_leave: ActionHandler = async function (
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

	await dao.mustMembership(teamId, userId, schema.MEMBERSHIP_ROLE.MEMBER, schema.MEMBERSHIP_ROLE.VIEWER);

	await dao.deleteMembership(teamId, userId);

	return {};
};

export const team_update: ActionHandler = async function (
	{ env },
	{
		userId,
		teamId,
		displayName,
	}: {
		userId: string;
		teamId: string;
		displayName: string;
	}
) {
	const dao = new DAO(env);

	await dao.mustTeam(teamId);

	await dao.mustMembership(teamId, userId, schema.MEMBERSHIP_ROLE.ADMIN);

	await dao.updateTeam(teamId, { displayName });

	return {};
};

export const team_delete: ActionHandler = async function (
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

	await dao.mustMembership(teamId, userId, schema.MEMBERSHIP_ROLE.ADMIN);

	await dao.deleteTeam(teamId);

	return {};
};

export const team_get: ActionHandler = async function (
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

	const team = await dao.mustTeam(teamId);

	const membership = await dao.mustMembership(teamId, userId);

	return {
		team: Object.assign({}, team, {
			deletedAt: undefined,
			membershipId: membership.id,
			membershipRole: membership.role,
			membershipCreatedAt: membership.createdAt,
		}),
	};
};

export const team_list: ActionHandler = async function (
	{ env },
	{
		userId,
	}: {
		userId: string;
	}
) {
	const dao = new DAO(env);

	const teams = await dao.listUserTeams(userId);

	return { teams };
};

export const team_create: ActionHandler = async function (
	{ env },
	{
		displayName,
		userId,
	}: {
		displayName: string;
		userId: string;
	}
) {
	const dao = new DAO(env);

	// validate max team per user
	{
		const count = await dao.countUserCreatedTeams(userId);

		if (count > LIMIT_TEAM_PER_USER) {
			halt(`user ${userId} has reached the limit of ${LIMIT_TEAM_PER_USER} teams`, 400);
		}
	}

	const team = await dao.createTeam({ userId, displayName });

	const membership = await dao.upsertMembership(team.id, userId, schema.MEMBERSHIP_ROLE.ADMIN);

	return {
		team,
		membership,
	};
};
