export type Bindings = {
	SECRET_KEY: string;

	AI: Ai;

	VECTORIZE_MAIN_SENTENCES: VectorizeIndex;

	QUEUE_MAIN_DOCUMENT_ANALYSIS: Queue<{ documentId: string }>;
	QUEUE_MAIN_CHAT_GENERATION: Queue<{ historyId: string }>;

	STANZA_SECRET_KEY: string;

	DB_MAIN: D1Database;

	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;

	GITHUB_DEV_CLIENT_ID: string;
	GITHUB_DEV_CLIENT_SECRET: string;
};

export type ActionRequest = {
	env: Bindings;
	ctx: ExecutionContext;
	internal?: { scheduled: ScheduledController | undefined };
};

export type ActionHandler<T = any, U = any> = (req: ActionRequest, args: T) => Promise<U>;

export const USER_AGENT = 'cloudflare-workers/mallam-backend';

export type TokenPayload = {
	sub: string;
	name: string;
	iat: number;
	exp: number;
	x_vn: string; // vendor
	x_ua: string; // user-agent sha1[0:16]
};

export type User = {
	id: string;
	vendor: string;
	name: string;
};

export function emptyUser(): User {
	return {
		id: '',
		vendor: '',
		name: '',
	};
}

export function userFromTokenPayload(payload: TokenPayload): User {
	return {
		id: payload.sub,
		vendor: payload.x_vn,
		name: payload.name,
	};
}
