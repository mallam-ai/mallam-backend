import { ActionHandler } from '../types';

export const ping: ActionHandler = async ({ env }, {}) => {
	return {
		success: true,
		message: 'pong'
	};
};
