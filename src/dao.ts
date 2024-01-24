import * as schema from '../schema-main';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, isNull, inArray, sql, asc, desc, gt, or, gte, lte, not } from 'drizzle-orm';
import { Bindings } from './types';
import { halt } from './utils';
import { create, groupBy, lt } from 'lodash';

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

	async mustChat(chatId: string) {
		const chat = await this.db.query.tChats.findFirst({ where: and(eq(schema.tChats.id, chatId), isNull(schema.tChats.deletedAt)) });
		if (!chat) {
			halt(`chat ${chatId} not found`, 404);
		}
		return chat;
	}

	async mustHistory(historyId: string) {
		const history = await this.db.query.tHistories.findFirst({ where: eq(schema.tHistories.id, historyId) });
		if (!history) {
			halt(`history ${historyId} not found`, 404);
		}
		return history;
	}

	async listHistories(chatId: string) {
		return await this.db.query.tHistories.findMany({
			where: and(eq(schema.tHistories.chatId, chatId)),
			orderBy: [asc(schema.tHistories.createdAt)],
		});
	}

	async deleteChat(chatId: string) {
		await this.db.update(schema.tChats).set({ deletedAt: new Date() }).where(eq(schema.tChats.id, chatId));
	}

	async listHistoriesBefore(chatId: string, history: { id: string; createdAt: Date }) {
		return await this.db.query.tHistories.findMany({
			where: and(
				eq(schema.tHistories.chatId, chatId),
				lte(schema.tHistories.createdAt, history.createdAt),
				not(eq(schema.tHistories.id, history.id))
			),
			orderBy: [asc(schema.tHistories.createdAt)],
			limit: 20,
		});
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

	async countChats(teamId: string, userId: string) {
		const count = (
			await this.db
				.select({
					value: sql<number>`count(${schema.tChats.id})`,
				})
				.from(schema.tChats)
				.where(and(eq(schema.tChats.userId, userId), eq(schema.tChats.teamId, teamId), isNull(schema.tChats.deletedAt)))
		)[0];
		return count.value;
	}

	async listChats(teamId: string, userId: string, { offset, limit }: { offset: number; limit: number }) {
		return await this.db.query.tChats.findMany({
			where: and(eq(schema.tChats.teamId, teamId), eq(schema.tChats.userId, userId), isNull(schema.tChats.deletedAt)),
			orderBy: [desc(schema.tChats.createdAt)],
			offset,
			limit,
		});
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

	async updateDocumentsStatus(documentIds: string[], status: string) {
		await this.db.update(schema.tDocuments).set({ status }).where(inArray(schema.tDocuments.id, documentIds));
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

	async listDocumentsFailedToAnalyze(teamId: string) {
		return this.db
			.select({ id: schema.tDocuments.id })
			.from(schema.tDocuments)
			.where(and(eq(schema.tDocuments.teamId, teamId), eq(schema.tDocuments.status, schema.DOCUMENT_STATUS.FAILED)));
	}

	async listDocumentsWithSentenceIds(sentenceIds: string[], { contextSize }: { contextSize: number }) {
		const sentences = await this.db.query.tSentences.findMany({
			where: inArray(schema.tSentences.id, sentenceIds),
		});

		const sentenceGroups = groupBy(sentences, 'documentId');

		type Document = Awaited<ReturnType<typeof this.mustDocument>>;

		type Sentence = Awaited<ReturnType<typeof this.listSentences>>[0] & { highlighted: boolean };

		const results: Array<Document & { sentences: Sentence[] }> = [];

		for (const documentId of Object.keys(sentenceGroups)) {
			const document = await this.db.query.tDocuments.findFirst({ where: eq(schema.tDocuments.id, documentId) });
			const sentences = await this.db.query.tSentences.findMany({
				where: and(
					eq(schema.tSentences.documentId, documentId),
					or(
						...sentenceGroups[documentId].map((record) =>
							and(
								gte(schema.tSentences.sequenceId, record.sequenceId - contextSize),
								lte(schema.tSentences.sequenceId, record.sequenceId + contextSize)
							)
						)
					)
				),
			});
			results.push(
				Object.assign({}, document, {
					sentences: sentences.map((s) =>
						Object.assign({}, s, {
							highlighted: sentenceIds.includes(s.id),
						})
					),
				})
			);
		}

		return results;
	}

	async updateHistoryStatus(historyId: string, status: string) {
		await this.db.update(schema.tHistories).set({ status }).where(eq(schema.tHistories.id, historyId));
	}

	async updateHistoryGeneratedContent(historyId: string, content: string) {
		await this.db
			.update(schema.tHistories)
			.set({ status: schema.HISTORY_STATUS.GENERATED, content })
			.where(eq(schema.tHistories.id, historyId));
	}

	async deleteSentences(documentId: string) {
		await this.db.delete(schema.tSentences).where(eq(schema.tSentences.documentId, documentId));
	}

	async inputChat(
		{
			id,
			teamId,
			userId,
		}: {
			id: string;
			teamId: string;
			userId: string;
		},
		content: string
	) {
		const createdAt_1 = new Date();
		const createdAt_2 = new Date(createdAt_1.getTime() + 50);

		const assistantHistoryId = crypto.randomUUID();

		await this.db
			.insert(schema.tHistories)
			.values([
				{
					id: crypto.randomUUID(),
					teamId,
					userId,
					chatId: id,
					createdAt: createdAt_1,
					role: schema.HISTORY_ROLE.USER,
					status: schema.HISTORY_STATUS.NONE,
					content: content,
				},
				{
					id: assistantHistoryId,
					teamId,
					userId,
					chatId: id,
					createdAt: createdAt_2,
					role: schema.HISTORY_ROLE.ASSISTANT,
					status: schema.HISTORY_STATUS.PENDING,
					content: '',
				},
			])
			.returning();

		return { assistantHistoryId };
	}

	async createChat({
		teamId,
		userId,
		title,
		context,
		content,
	}: {
		teamId: string;
		userId: string;
		title: string;
		context: string;
		content: string;
	}) {
		let now = new Date();

		const chat = (
			await this.db
				.insert(schema.tChats)
				.values({
					id: crypto.randomUUID(),
					teamId,
					userId,
					title,
					createdAt: now,
				})
				.returning()
		)[0];

		now = new Date(now.getTime() + 50);

		if (context) {
			const createdAt_1 = now;
			now = new Date(now.getTime() + 50);
			const createdAt_2 = now;
			now = new Date(now.getTime() + 50);
			await this.db
				.insert(schema.tHistories)
				.values([
					{
						id: crypto.randomUUID(),
						teamId,
						userId,
						chatId: chat.id,
						createdAt: createdAt_1,
						role: schema.HISTORY_ROLE.SYSTEM,
						status: schema.HISTORY_STATUS.NONE,
						content: 'Context:\n' + context,
					},
					{
						id: crypto.randomUUID(),
						teamId,
						userId,
						chatId: chat.id,
						createdAt: createdAt_2,
						role: schema.HISTORY_ROLE.SYSTEM,
						status: schema.HISTORY_STATUS.NONE,
						content: `When answering the question or responding, use the context provided, if it is provided and relevant.`,
					},
				])
				.returning();
		}

		const createdAt_1 = now;
		now = new Date(now.getTime() + 50);
		const createdAt_2 = now;
		now = new Date(now.getTime() + 50);

		const assistantHistoryId = crypto.randomUUID();

		await this.db
			.insert(schema.tHistories)
			.values([
				{
					id: crypto.randomUUID(),
					teamId,
					userId,
					chatId: chat.id,
					createdAt: createdAt_1,
					role: schema.HISTORY_ROLE.USER,
					status: schema.HISTORY_STATUS.NONE,
					content,
				},
				{
					id: assistantHistoryId,
					teamId,
					userId,
					chatId: chat.id,
					createdAt: createdAt_2,
					role: schema.HISTORY_ROLE.ASSISTANT,
					status: schema.HISTORY_STATUS.PENDING,
					content: '',
				},
			])
			.returning();

		return { chat, assistantHistoryId };
	}
}
