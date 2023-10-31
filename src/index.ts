import { Hono } from 'hono';
import { Bindings } from './types';
import { Halt, halt } from './utils';
import { getActionHandler } from './actions';

const app = new Hono<{ Bindings: Bindings }>();

// app route - /invoke/:action
app.post('/invoke/:action', async (c) => {
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
};
