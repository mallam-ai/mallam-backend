import { ActionHandler, emptyUser, TokenPayload, User, USER_AGENT, userFromTokenPayload } from '../types';
import { decodeJWT, encodeJWT, encodeQuery, halt, isDebugURL, randomHex, sha1Short } from '../utils';

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
		halt('github oauth token request failed');
	}
	const dataToken: any = await resToken.json();
	if (!dataToken.access_token) {
		halt('github oauth token request failed');
	}
	const res = await fetch('https://api.github.com/user', {
		headers: {
			accept: 'application/json',
			'user-agent': USER_AGENT,
			authorization: 'Bearer ' + dataToken.access_token,
		},
	});
	if (!res.ok) {
		halt('github user request failed');
	}
	return (await res.json()) as { id: number; login: string };
}

async function createUserToken({ user, user_agent, secret_key }: { user: User; user_agent: string; secret_key: string }): Promise<string> {
	const data: TokenPayload = {
		sub: user.id,
		name: user.name,
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 3,
		x_vn: user.vendor,
		x_ua: await sha1Short(user_agent),
	};
	return encodeJWT(data, secret_key);
}

export const oauth_authorize_user: ActionHandler = async function (
	{ env },
	{
		vendor,
		redirect_uri,
		user_agent,
		state,
		code,
	}: { vendor: string; redirect_uri: string; user_agent: string; state: string; code: string }
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
	const user: User = {
		id: 'github::' + id,
		name: login,
		vendor,
	};
	return {
		token: await createUserToken({ user, user_agent, secret_key: env.SECRET_KEY }),
		user,
	};
};

export const authenticate_user: ActionHandler = async ({ env }, { token, user_agent }) => {
	if (token) {
		return userFromTokenPayload(await decodeJWT(token, user_agent, env.SECRET_KEY));
	}
	return emptyUser();
};
