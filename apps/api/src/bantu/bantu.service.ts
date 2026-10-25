import { canChangeRole, workspaceRoleOf } from "@crm/auth/organization";
import type { Db } from "@crm/db";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../config/env.validation";
import { InjectDatabase } from "../database/database.constants";
import { BANTU_TASK } from "./bantu.config";
import type { CreateBantuTaskInput } from "./bantu.contracts";

@Injectable()
export class BantuService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly config: ConfigService<EnvironmentVariables, true>,
	) {}

	async list(userId: string) {
		const role = await this.requireMember(userId);
		const rows = await this.db.bantuTask.findMany({
			orderBy: { createdAt: "desc" },
			take: BANTU_TASK.maxTasks,
			include: { createdBy: { select: { name: true, email: true } } },
		});
		return {
			tasks: rows.map((row) => ({
				id: row.id,
				repository: row.repository,
				request: row.request,
				status: row.status,
				branch: row.branch,
				report: row.report,
				failure: row.failure,
				createdAt: row.createdAt.toISOString(),
				updatedAt: row.updatedAt.toISOString(),
				createdBy: row.createdBy.name || row.createdBy.email,
			})),
			canApprove: canChangeRole(role),
			workerConfigured: Boolean(
				this.config.get("BANTU_WORKER_TOKEN", { infer: true })?.trim(),
			),
		};
	}

	async create(userId: string, input: CreateBantuTaskInput) {
		await this.requireMember(userId);
		const row = await this.db.bantuTask.create({
			data: {
				repository: input.repository,
				request: input.request,
				createdById: userId,
			},
			include: { createdBy: { select: { name: true, email: true } } },
		});
		return this.toOutput(row);
	}

	async approve(userId: string, id: string, confirmRepositoryRights: true) {
		if (!confirmRepositoryRights) {
			throw new BadRequestException(
				"Confirm that you have rights to this repository.",
			);
		}
		await this.requireApprover(userId);
		const changed = await this.db.bantuTask.updateMany({
			where: { id, status: "DRAFT" },
			data: {
				status: "QUEUED",
				approvedById: userId,
				workerId: null,
				leaseUntil: null,
				branch: null,
				report: null,
				failure: null,
				startedAt: null,
				finishedAt: null,
			},
		});
		if (changed.count !== 1) {
			throw new BadRequestException("Only a draft task can be approved.");
		}
		return this.get(id);
	}

	async retry(userId: string, id: string) {
		await this.requireApprover(userId);
		const changed = await this.db.bantuTask.updateMany({
			where: { id, status: { in: ["FAILED", "PAUSED"] } },
			data: {
				status: "QUEUED",
				approvedById: userId,
				workerId: null,
				leaseUntil: null,
				branch: null,
				report: null,
				failure: null,
				startedAt: null,
				finishedAt: null,
			},
		});
		if (changed.count !== 1) {
			throw new BadRequestException(
				"Only a failed or paused task can be retried.",
			);
		}
		return this.get(id);
	}

	async claim(workerId: string) {
		if (!this.workerConfigured()) {
			throw new ServiceUnavailableException(
				"The BANTU worker is not configured.",
			);
		}
		const now = new Date();
		return this.db.$transaction(async (tx) => {
			await tx.bantuTask.updateMany({
				where: { status: "RUNNING", leaseUntil: { lt: now } },
				data: {
					status: "FAILED",
					workerId: null,
					leaseUntil: null,
					failure:
						"The BANTU worker lease expired. An owner or admin must retry this task.",
					finishedAt: now,
				},
			});
			const task = await tx.bantuTask.findFirst({
				where: { status: "QUEUED" },
				orderBy: { createdAt: "asc" },
			});
			if (!task) return null;
			const claimed = await tx.bantuTask.updateMany({
				where: { id: task.id, status: "QUEUED" },
				data: {
					status: "RUNNING",
					workerId,
					leaseUntil: new Date(now.getTime() + BANTU_TASK.leaseMs),
					startedAt: now,
				},
			});
			if (claimed.count !== 1) return null;
			const result = await tx.bantuTask.findUnique({ where: { id: task.id } });
			return result
				? {
						id: result.id,
						repository: result.repository,
						request: result.request,
					}
				: null;
		});
	}

	async heartbeat(id: string, workerId: string) {
		const updated = await this.db.bantuTask.updateMany({
			where: { id, status: "RUNNING", workerId },
			data: { leaseUntil: new Date(Date.now() + BANTU_TASK.leaseMs) },
		});
		if (updated.count !== 1) {
			throw new NotFoundException(
				"The BANTU task is no longer assigned to this worker.",
			);
		}
		return { renewed: true };
	}

	async complete(
		id: string,
		workerId: string,
		input: {
			status: "DONE" | "FAILED" | "PAUSED";
			branch: string | null;
			report: string | null;
			failure: string | null;
		},
	) {
		if (input.branch && !/^bantu\/[A-Za-z0-9._/-]{1,150}$/.test(input.branch)) {
			throw new BadRequestException(
				"The worker returned an invalid branch name.",
			);
		}
		if (input.report && input.report.length > BANTU_TASK.maxReportChars) {
			throw new BadRequestException("The worker report is too large.");
		}
		const now = new Date();
		const updated = await this.db.bantuTask.updateMany({
			where: { id, status: "RUNNING", workerId },
			data: {
				status: input.status,
				branch: input.branch,
				report: input.report,
				failure: input.failure,
				workerId: null,
				leaseUntil: null,
				finishedAt: now,
			},
		});
		if (updated.count !== 1) {
			throw new NotFoundException(
				"The BANTU task is no longer assigned to this worker.",
			);
		}
		return { completed: true };
	}

	private async get(id: string) {
		const row = await this.db.bantuTask.findUnique({
			where: { id },
			include: { createdBy: { select: { name: true, email: true } } },
		});
		if (!row) throw new NotFoundException("BANTU task not found.");
		return this.toOutput(row);
	}

	private toOutput(row: {
		id: string;
		repository: string;
		request: string;
		status: string;
		branch: string | null;
		report: string | null;
		failure: string | null;
		createdAt: Date;
		updatedAt: Date;
		createdBy: { name: string; email: string };
	}) {
		return {
			id: row.id,
			repository: row.repository,
			request: row.request,
			status: row.status,
			branch: row.branch,
			report: row.report,
			failure: row.failure,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			createdBy: row.createdBy.name || row.createdBy.email,
		};
	}

	private async requireApprover(userId: string) {
		const role = await this.requireMember(userId);
		if (!canChangeRole(role)) {
			throw new ForbiddenException(
				"Only an owner or admin can approve BANTU tasks.",
			);
		}
	}

	private async requireMember(userId: string) {
		const role = await workspaceRoleOf(userId);
		if (!role) {
			throw new ForbiddenException(
				"You must be a workspace member to use BANTU.",
			);
		}
		return role;
	}

	private workerConfigured() {
		return Boolean(
			this.config.get("BANTU_WORKER_TOKEN", { infer: true })?.trim(),
		);
	}
}
