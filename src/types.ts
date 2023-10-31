export type Bindings = {
	SECRET_KEY: string;
};

export type ActionRequest = {
	env: Bindings;
	ctx: ExecutionContext;
	internal?: { scheduled: ScheduledController | undefined };
};

export type ActionHandler<T = any, U = any> = (req: ActionRequest, args: T) => Promise<U>;
