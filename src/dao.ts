import * as schema from '../schema-main';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, isNull, inArray, sql, asc, desc, gt } from 'drizzle-orm';
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

	async createTeam({ userId, displayName }: { userId: string; displayName: string }) {
		return (
			await this.db
				.insert(schema.tTeams)
				.values({
					id: crypto.randomUUID(),
					displayName,
					createdBy: userId,
					createdAt: new Date(),
				})
				.returning()
		)[0];
	}

	async countUserCreatedTeams(userId: string) {
		const count = (
			await this.db
				.select({ value: sql<number>`count(${schema.tTeams.id})` })
				.from(schema.tTeams)
				.where(and(eq(schema.tTeams.createdBy, userId), isNull(schema.tTeams.deletedAt)))
		)[0];

		return count.value;
	}

	async listUserTeams(userId: string) {
		// due to cloudflare D1 bug, we have to use this workaround
		const memberships = await this.db.query.tMemberships.findMany({
			where: eq(schema.tMemberships.userId, userId),
		});

		const teamIds = memberships.map((m) => m.teamId);

		const teams = await this.db.query.tTeams.findMany({
			where: and(inArray(schema.tTeams.id, teamIds), isNull(schema.tTeams.deletedAt)),
		});

		return teams.map((team) => {
			const membership = memberships.find((m) => m.teamId === team.id)!;
			return Object.assign(
				{},
				team,
				{
					deletedAt: undefined,
				},
				membership
					? {
							membershipId: membership.id,
							membershipRole: membership.role,
							membershipCreatedAt: membership.createdAt,
					  }
					: {}
			);
		});
	}

	async upsertUser({ vendor, vendorUserId, displayName }: { vendor: string; vendorUserId: string; displayName: string }) {
		return (
			await this.db
				.insert(schema.tUsers)
				.values({
					id: crypto.randomUUID(),
					vendor,
					vendorUserId,
					displayName,
					createdAt: new Date(),
				})
				.onConflictDoUpdate({
					target: [schema.tUsers.vendor, schema.tUsers.vendorUserId],
					set: {
						displayName,
					},
				})
				.returning()
		)[0];
	}

	async mustUser(userId: string) {
		const user = await this.db.query.tUsers.findFirst({ where: eq(schema.tUsers.id, userId) });
		if (!user) {
			halt(`user ${userId} not found`, 404);
		}
		return user;
	}

	async listMembershipWithUser(teamId: string) {
		const memberships = await this.db.query.tMemberships.findMany({ where: eq(schema.tMemberships.teamId, teamId) });

		const membershipUserIds = memberships.map((m) => m.userId);

		const users = await this.db.query.tUsers.findMany({ where: inArray(schema.tUsers.id, membershipUserIds) });

		return memberships.map((m) => {
			const user = users.find((u) => u.id === m.userId)!;
			return Object.assign(
				{},
				m,
				user
					? {
							userVendor: user.vendor,
							userVendorUserId: user.vendorUserId,
							userDisplayName: user.displayName,
							userCreatedAt: user.createdAt,
					  }
					: {}
			);
		});
	}

	async deleteMembership(teamId: string, userId: string) {
		await this.db.delete(schema.tMemberships).where(and(eq(schema.tMemberships.userId, userId), eq(schema.tMemberships.teamId, teamId)));
	}

	async upsertMembership(teamId: string, userId: string, role: string) {
		return await this.db
			.insert(schema.tMemberships)
			.values({
				id: crypto.randomUUID(),
				userId,
				teamId,
				role: role,
				createdAt: new Date(),
				createdBy: userId,
			})
			.onConflictDoUpdate({
				target: [schema.tMemberships.userId, schema.tMemberships.teamId],
				set: { role: role },
			})
			.returning();
	}

	async mustMembership(teamId: string, userId: string, ...roles: Array<string>) {
		const clauses = [eq(schema.tMemberships.userId, userId), eq(schema.tMemberships.teamId, teamId)];

		if (roles.length == 1) {
			clauses.push(eq(schema.tMemberships.role, roles[0]));
		} else if (roles.length > 1) {
			clauses.push(inArray(schema.tMemberships.role, roles));
		}

		const membership = await this.db.query.tMemberships.findFirst({
			where: and(...clauses),
		});

		if (!membership) {
			halt(`user ${userId} does not have role '${roles.join(',')}' in ${teamId}`, 403);
		}

		return membership;
	}

	async deleteTeam(teamId: string) {
		await this.db.update(schema.tTeams).set({ deletedAt: new Date() }).where(eq(schema.tTeams.id, teamId));
	}

	async updateTeam(teamId: string, { displayName }: { displayName: string }) {
		await this.db.update(schema.tTeams).set({ displayName }).where(eq(schema.tTeams.id, teamId));
	}

	async mustTeam(teamId: string) {
		const team = await this.db.query.tTeams.findFirst({ where: and(eq(schema.tTeams.id, teamId), isNull(schema.tTeams.deletedAt)) });
		if (!team) {
			halt(`team ${teamId} not found`, 404);
		}
		return team;
	}

	async mustDocument(documentId: string) {
		const document = await this.db.query.tDocuments.findFirst({
			where: and(eq(schema.tDocuments.id, documentId), isNull(schema.tDocuments.deletedAt)),
		});
		if (!document) {
			halt(`document ${documentId} not found`, 404);
		}
		return document;
	}

	async deleteDocument(documentId: string) {
		await this.db.update(schema.tDocuments).set({ deletedAt: new Date() }).where(eq(schema.tDocuments.id, documentId));
	}

	async createDocument({ teamId, title, content, createdBy }: { teamId: string; title: string; content: string; createdBy: string }) {
		return (
			await this.db
				.insert(schema.tDocuments)
				.values({
					id: crypto.randomUUID(),
					teamId,
					title,
					content,
					status: schema.DOCUMENT_STATUS.CREATED,
					createdBy,
					createdAt: new Date(),
				})
				.returning()
		)[0];
	}

	async countDocuments(teamId: string) {
		const count = (
			await this.db
				.select({
					value: sql<number>`count(${schema.tDocuments.id})`,
				})
				.from(schema.tDocuments)
				.where(and(eq(schema.tDocuments.teamId, teamId), isNull(schema.tDocuments.deletedAt)))
		)[0];
		return count.value;
	}

	async listDocuments(teamId: string, { offset, limit }: { offset: number; limit: number }) {
		return await this.db.query.tDocuments.findMany({
			where: and(eq(schema.tDocuments.teamId, teamId), isNull(schema.tDocuments.deletedAt)),
			orderBy: [desc(schema.tDocuments.createdAt)],
			offset,
			limit,
		});
	}

	async createSentences(
		document: {
			id: string;
			teamId: string;
			createdBy: string;
		},
		sentences: Array<{ sequenceId: number; content: string }>
	) {
		const rows = await this.db
			.insert(schema.tSentences)
			.values(
				sentences.map((s) => ({
					id: `${document.id}-${s.sequenceId}`,
					documentId: document.id,
					teamId: document.teamId,
					sequenceId: s.sequenceId,
					content: s.content,
					isAnalyzed: false,
					createdBy: document.createdBy,
					createdAt: new Date(),
				}))
			)
			.onConflictDoNothing()
			.returning();

		return rows;
	}

	async resetDocument(documentId: string, { title, content }: { title: string; content: string }) {
		await this.db
			.update(schema.tDocuments)
			.set({ title, content, status: schema.DOCUMENT_STATUS.CREATED })
			.where(eq(schema.tDocuments.id, documentId));
	}

	async updateDocumentStatus(documentId: string, status: string) {
		await this.db.update(schema.tDocuments).set({ status }).where(eq(schema.tDocuments.id, documentId));
	}

	async updateSentenceAnalyzed(sentenceId: string, isAnalyzed: boolean) {
		await this.db.update(schema.tSentences).set({ isAnalyzed }).where(eq(schema.tSentences.id, sentenceId));
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

	async listSentences(documentId: string) {
		return await this.db.query.tSentences.findMany({
			where: eq(schema.tSentences.documentId, documentId),
			orderBy: [asc(schema.tSentences.sequenceId)],
		});
	}

	async deleteSentences(documentId: string) {
		await this.db.delete(schema.tSentences).where(eq(schema.tSentences.documentId, documentId));
	}
}
