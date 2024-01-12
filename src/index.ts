import { Hono } from 'hono';
import { Bindings } from './types';
import { Halt, halt } from './utils';
import { getActionHandler } from './actions';

const app = new Hono<{ Bindings: Bindings }>();

// app route - /invoke/:action
app.post('/invoke/:action', async (c) => {
	if (c.req.query('secret_key') !== c.env.SECRET_KEY && c.req.header('X-Secret-Key') !== c.env.SECRET_KEY) {
		halt('/invoke/:action: secret key is not valid');
	}

	const action = c.req.param('action');
	if (!action) {
		halt('/invoke/:action: action is required');
	}

	const fn = getActionHandler(action);
	if (!fn) {
		halt(`/invoke/:action: action '${action}' is not found`);
	}

	const args = await c.req.json();

	return c.json(await fn({ env: c.env, ctx: c.executionCtx }, args));
});

// app error handler
app.onError((e, c) => {
	if (e instanceof Halt) {
		return c.json({ error: e.error }, e.code);
	}
	return c.json({ error: `${e}` }, 500);
});

export default {
	fetch: app.fetch,

	async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext): Promise<void> {
		const fn = getActionHandler('scheduled');
		if (!fn) {
			console.log('scheduled: no action matched for: scheduled');
			return;
		}
		await fn({ env, ctx }, {});
	},

	async queue(batch: MessageBatch<any>, env: Bindings, ctx: ExecutionContext): Promise<void> {
		// wait till all messages are processed
		ctx.waitUntil(
			// Promise.all returns a promise that resolves when all of the promises in the iterable argument have resolved
			Promise.all(
				batch.messages.map((msg) => {
					// returns a promise that always resolves
					return new Promise((resolve) => {
						const actionName = 'queue-' + batch.queue;
						const fn = getActionHandler(actionName);
						if (!fn) {
							console.log('queue: no action matched for: ' + actionName);
							msg.retry();
							resolve({});
							return;
						}
						fn({ env, ctx }, msg.body)
							.then(() => msg.ack())
							.catch((e) => {
								console.log(`queue: action failed: ${e}`);
								msg.retry();
							})
							.finally(() => resolve({}));
					});
				})
			)
		);
	},
};
