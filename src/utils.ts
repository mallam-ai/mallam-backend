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
