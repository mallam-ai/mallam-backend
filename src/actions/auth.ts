import { ActionHandler } from '../types';
import { encodeQuery, halt, randomHex } from '../utils';

export const oauth_create_authorization_uri: ActionHandler = async function({ env }, { redirect_uri }) {
	return {
		url:
			'https://github.com/login/oauth/authorize?' +
			encodeQuery({
				client_id: env.GITHUB_CLIENT_ID,
				redirect_uri,
				scope: '',
				state: randomHex(8)
			})
	};
};


export const USER_AGENT = 'cloudflare-workers/mallam-backend';

async function githubAuthorizeUser({
																		 redirect_uri,
																		 client_id,
																		 client_secret,
																		 code,
																		 state
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
			'user-agent': USER_AGENT
		},
		body: encodeQuery({
			client_id,
			client_secret,
			code,
			redirect_uri
		})
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
			authorization: 'Bearer ' + dataToken.access_token
		}
	});
	if (!res.ok) {
		halt('github user request failed');
	}
	return await res.json() as { id: number; login: string };
}
