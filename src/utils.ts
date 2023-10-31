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
