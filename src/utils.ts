import { Bindings, TokenPayload } from './types';
import { Env } from './types';

/**
 * wait for ms, Promise version of setTimeout
 * @param ms
 */
export async function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Halt error for interrupting request and return error code
 */
export class Halt extends Error {
	code: number;

	error: string;

	constructor(error: string, code: number) {
		super(`halt ${code}: ${error}`);
		this.error = error;
		this.code = code;
	}
}

/**
 * create and throw an Halt error
 * @param error
 * @param code
 */
export function halt(error: string, code = 400): never {
	throw new Halt(error, code);
}

/**
 * decode a base64 string
 * @param str
 * @returns
 */
export function decodeBase64(str: string): Uint8Array {
	const binary = atob(str);
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	const half = binary.length / 2;
	for (let i = 0, j = binary.length - 1; i <= half; i++, j--) {
		bytes[i] = binary.charCodeAt(i);
		bytes[j] = binary.charCodeAt(j);
	}
	return bytes;
}

/**
 * encode a binary to base64 string
 * @param buf
 * @param noPadding
 * @returns
 */
export function encodeBase64(buf: ArrayBufferLike, noPadding?: boolean): string {
	let s = btoa(String.fromCharCode(...new Uint8Array(buf)));
	if (noPadding) {
		s = s.replaceAll('=', '');
	}
	return s;
}

/**
 * decode a url-safe base64 string
 * @param str
 * @returns
 */
export function decodeBase64Url(str: string): Uint8Array {
	return decodeBase64(str.replace(/[_-]/g, (m) => ({ _: '/', '-': '+' }[m] ?? m)));
}

/**
 * encode a binary to url-safe base64 string
 * @param buf
 * @param noPadding
 * @returns
 */
export function encodeBase64Url(buf: ArrayBufferLike, noPadding?: boolean): string {
	return encodeBase64(buf, noPadding).replace(/[\/+]/g, (m) => ({ '/': '_', '+': '-' }[m] ?? m));
}

/**
 * decode a url-safe base64 string to JSON
 * @param src
 * @returns
 */
export function decodeBase64UrlJSON(src: any): any {
	return JSON.parse(new TextDecoder('utf-8').decode(decodeBase64Url(src)));
}

/**
 * encode a JSON to url-safe base64 string
 * @param j
 * @param noPadding
 * @returns
 */
export function encodeBase64UrlJSON(j: any, noPadding?: boolean): string {
	return encodeBase64Url(new TextEncoder().encode(JSON.stringify(j)), noPadding);
}

/**
 * encode url query
 * @param data key-value to encode
 */
export function encodeQuery(data: Record<string, string>): string {
	return Object.keys(data)
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
		.join('&');
}

/**
 * encode binary to hex
 * @param b binary
 */
export function encodeHex(b: Uint8Array): string {
	return Array.from(b)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * generate random hex string
 * @param c
 */
export function randomHex(c: number): string {
	const buf = new Uint8Array(c);
	crypto.getRandomValues(buf);
	return encodeHex(buf);
}

/**
 * sha1 hash a string of binary
 * @param s string or binary
 */
export async function sha1(s: string | Uint8Array): Promise<string> {
	if (typeof s === 'string') {
		s = new TextEncoder().encode(s);
	}
	const digest = await crypto.subtle.digest('SHA-1', s);

	return encodeHex(new Uint8Array(digest));
}

/**
 * sha256 hash a string of binary
 * @param s string or binary
 */
export async function sha256(s: string | Uint8Array): Promise<string> {
	if (typeof s === 'string') {
		s = new TextEncoder().encode(s);
	}
	const digest = await crypto.subtle.digest('SHA-256', s);

	return encodeHex(new Uint8Array(digest));
}

/**
 * sha1 hash a string of binary and return the first 16 bytes
 * @param s string or binary
 */
export async function sha1Short(s: string | Uint8Array): Promise<string> {
	return (await sha1(s)).substring(0, 16);
}

/**
 * import WebCrypto HMAC key for 'sign' and 'verify'
 * @param secret secret string in utf-8 encoding
 * @param hash hash algorithm
 * @return CryptoKey created from secret
 */
async function hmacImportKey(secret: string, hash: 'SHA-256' | 'MD5' = 'SHA-256'): Promise<CryptoKey> {
	return await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{
			name: 'HMAC',
			hash,
		},
		false,
		['sign', 'verify']
	);
}

/**
 * sign data with HMAC
 * @param src data to sign
 * @param secret secret string in utf-8 encoding
 * @param hash hash algorithm
 */
export async function hmacSign(src: string, secret: string, hash: 'SHA-256' | 'MD5'): Promise<ArrayBuffer> {
	return await crypto.subtle.sign('HMAC', await hmacImportKey(secret, hash), new TextEncoder().encode(src));
}

/**
 * verify HMAC signature
 * @param src data to verify
 * @param signature signature to verify
 * @param secret secret string in utf-8 encoding
 * @param hash hash algorithm
 */
export async function hmacVerify(src: string, signature: Uint8Array, secret: string, hash: 'SHA-256' | 'MD5'): Promise<boolean> {
	return await crypto.subtle.verify('HMAC', await hmacImportKey(secret, hash), signature, new TextEncoder().encode(src));
}

const JWT_HEADER_HS256 = {
	typ: 'JWT',
	alg: 'HS256',
};

/**
 * encode a payload to a valid jwt token string
 * @param data
 * @param secret
 * @returns
 */
export async function encodeJWT(data: TokenPayload, secret: string): Promise<string> {
	const head = encodeBase64UrlJSON(JWT_HEADER_HS256, true);
	const payload = encodeBase64UrlJSON(data, true);

	const sig = await hmacSign(head + '.' + payload, secret, 'SHA-256');
	return head + '.' + payload + '.' + encodeBase64Url(sig, true);
}

/**
 * decode and verify a jwt token string to payload
 * @param s
 * @param userAgent
 * @param secret
 * @returns
 */
export async function decodeJWT(s: string, userAgent: string, secret: string): Promise<TokenPayload> {
	const splits = s.split('.');
	if (splits.length !== 3) {
		halt('jwt: invalid format', 401);
	}

	const head = decodeBase64UrlJSON(splits[0]);
	if (head.typ !== JWT_HEADER_HS256.typ || head.alg !== JWT_HEADER_HS256.alg) {
		halt('jwt: invalid header', 401);
	}

	const valid = await hmacVerify(splits[0] + '.' + splits[1], decodeBase64Url(splits[2]), secret, 'SHA-256');
	if (!valid) {
		halt('jwt: invalid signature', 401);
	}

	const data: TokenPayload = decodeBase64UrlJSON(splits[1]);

	if (!data.sub) {
		halt('jwt: no subject', 401);
	}

	if (data.iat * 1000 > Date.now()) {
		halt('jwt: issued in the future', 401);
	}

	if (data.exp * 1000 < Date.now()) {
		halt('jwt: expired', 401);
	}

	if (data.x_ua !== (await sha1Short(userAgent))) {
		halt('jwt: invalid user agent', 401);
	}

	return data;
}

export function isDebugURL(url: string): boolean {
	const u = new URL(url);
	return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
}

export async function invokeStanzaSentenceSegmentation(env: Bindings, text: string): Promise<Array<string>> {
	const res = await fetch('https://mallam-ai-stanza.hf.space/sentence_segmentation', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Secret-Key': env.STANZA_SECRET_KEY,
		},
		body: JSON.stringify({ document: text }),
	});
	if (!res.ok) {
		throw new Error('failed to invoke stanza sentence segmentation');
	}
	const data = (await res.json()) as { sentences: Array<string> };

	return data.sentences;
}
