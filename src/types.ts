export type Bindings = {
	SECRET_KEY: string;

	AI: any;

	VECTORIZE_DATASETS: VectorizeIndex;

	QUEUE_VECTORIZE_SENTENCE: Queue;

	DB_DATASETS: D1Database;
};

export type ActionRequest = {
	env: Bindings;
	ctx: ExecutionContext;
	internal?: { scheduled: ScheduledController | undefined };
};

export type ActionHandler<T = any, U = any> = (req: ActionRequest, args: T) => Promise<U>;
