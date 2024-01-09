import { drizzle } from 'drizzle-orm/d1';
import { ActionHandler, User, USER_AGENT } from '../types';
import { encodeQuery, halt, isDebugURL, randomHex } from '../utils';
import { tUsers } from '../../schema-main';

export const oauth_create_authorization_uri: ActionHandler = async function (
	{ env },
	{ redirect_uri, vendor }: { redirect_uri: string; vendor: string }
) {
	if (vendor !== 'github') {
		halt(`invalid vendor: ${vendor}`);
	}

	const client_id = isDebugURL(redirect_uri) ? env.GITHUB_DEV_CLIENT_ID : env.GITHUB_CLIENT_ID;

	return {
		url:
			'https://github.com/login/oauth/authorize?' +
			encodeQuery({
				client_id,
				redirect_uri,
				scope: '',
				state: randomHex(8),
			}),
	};
};

async function githubAuthorizeUser({
	redirect_uri,
	client_id,
	client_secret,
	code,
	state,
}: {
	redirect_uri: string;
	client_id: string;
	client_secret: string;
	code: string;
	state: string;
}): Promise<{
	id: number;
	login: string;
}> {
	const resToken = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			accept: 'application/json',
			'user-agent': USER_AGENT,
		},
		body: encodeQuery({
			client_id,
			client_secret,
			code,
			redirect_uri,
		}),
	});
	if (!resToken.ok) {
		halt('github oauth token request failed: ' + (await resToken.text()));
	}
	const dataToken: any = await resToken.json();
	if (!dataToken.access_token) {
		halt('github oauth token request failed: ' + JSON.stringify(dataToken));
	}
	const res = await fetch('https://api.github.com/user', {
		headers: {
			accept: 'application/json',
			'user-agent': USER_AGENT,
			authorization: 'Bearer ' + dataToken.access_token,
		},
	});
	if (!res.ok) {
		halt('github user request failed: ' + (await res.text()));
	}
	return (await res.json()) as { id: number; login: string };
}

export const oauth_authorize_user: ActionHandler = async function (
	{ env },
	{ vendor, redirect_uri, state, code }: { vendor: string; redirect_uri: string; state: string; code: string }
) {
	if (vendor !== 'github') {
		halt(`invalid vendor: ${vendor}`);
	}
	const dev = isDebugURL(redirect_uri);
	const client_id = dev ? env.GITHUB_DEV_CLIENT_ID : env.GITHUB_CLIENT_ID;
	const client_secret = dev ? env.GITHUB_DEV_CLIENT_SECRET : env.GITHUB_CLIENT_SECRET;
	const { id, login } = await githubAuthorizeUser({
		redirect_uri,
		client_id,
		client_secret,
		code,
		state,
	});

	const uuid = crypto.randomUUID();

	const db = drizzle(env.DB_MAIN);

	const insertedUsers = await db
		.insert(tUsers)
		.values({
			id: crypto.randomUUID(),
			vendor,
			vendorUserId: id.toString(),
			displayName: login,
			createdAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [tUsers.vendor, tUsers.vendorUserId],
			set: {
				displayName: login,
			},
		})
		.returning();

	return {
		user: insertedUsers[0],
	};
};
