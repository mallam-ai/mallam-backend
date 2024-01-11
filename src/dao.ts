import * as schema from '../schema-main';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { Bindings } from './types';
import { halt } from './utils';

function dirzzleMain(env: Bindings) {
	return drizzle(env.DB_MAIN, { schema });
}

export class DAO {
	db: ReturnType<typeof dirzzleMain>;

	constructor(env: Bindings) {
		this.db = dirzzleMain(env);
	}

	async mustMembership(teamId: string, userId: string, ...roles: Array<string>) {
		if (roles.length === 0) {
			throw new Error('mustMembership: no roles provided');
		}

		const membership = await this.db.query.tMemberships.findFirst({
			where: and(eq(schema.tMemberships.userId, userId), eq(schema.tMemberships.teamId, teamId), inArray(schema.tMemberships.role, roles)),
		});

		if (!membership) {
			halt(`user ${userId} does not have role '${roles.join(',')}' in ${teamId}`, 403);
		}

		return membership;
	}

	async getTeam(teamId: string) {
		return await this.db.query.tTeams.findFirst({ where: and(eq(schema.tTeams.id, teamId), isNull(schema.tTeams.deletedAt)) });
	}

	async mustTeam(teamId: string) {
		const team = this.getTeam(teamId);
		if (!team) {
			halt(`team ${teamId} not found`, 404);
		}
		return team;
	}

	async getDocument(documentId: string) {
		return await this.db.query.tDocuments.findFirst({ where: eq(schema.tDocuments.id, documentId) });
	}

	async mustDocument(documentId: string) {
		const document = await this.getDocument(documentId);
		if (!document) {
			halt(`document ${documentId} not found`, 404);
		}
		return document;
	}

	async createDocument({ teamId, title, content, createdBy }: { teamId: string; title: string; content: string; createdBy: string }) {
		return (
			await this.db
				.insert(schema.tDocuments)
				.values({
					id: crypto.randomUUID(),
					teamId,
					isPublic: false,
					title,
					content,
					createdBy,
					createdAt: new Date(),
				})
				.returning()
		)[0];
	}

	async createSentence(
		document: Awaited<ReturnType<typeof this.mustDocument>>,
		{ sequenceId, content }: { sequenceId: number; content: string }
	) {
		const id = `${document.id}-${sequenceId}`;
		return (
			await this.db
				.insert(schema.tSentences)
				.values({
					id,
					documentId: document.id,
					teamId: document.teamId,
					sequenceId,
					content,
					createdBy: document.createdBy,
					createdAt: new Date(),
				})
				.onConflictDoNothing()
				.returning()
		)[0];
	}

	async getSentenceIds(documentId: string) {
		const sentences = await this.db
			.select({
				id: schema.tSentences.id,
			})
			.from(schema.tSentences)
			.where(eq(schema.tSentences.documentId, documentId));

		return sentences.map((s) => s.id);
	}

	async deleteSentences(documentId: string) {
		await this.db.delete(schema.tSentences).where(eq(schema.tSentences.documentId, documentId));
	}
}
