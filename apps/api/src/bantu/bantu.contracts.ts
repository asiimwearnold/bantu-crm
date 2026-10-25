import { z } from "zod";

export const bantuTaskStatus = z.enum([
	"DRAFT",
	"QUEUED",
	"RUNNING",
	"PAUSED",
	"DONE",
	"FAILED",
]);

export const createBantuTaskInput = z.object({
	repository: z
		.string()
		.trim()
		.min(1)
		.max(2048)
		.refine((value) => {
			try {
				const url = new URL(value);
				return (
					url.protocol === "https:" &&
					!url.username &&
					!url.password &&
					!url.search &&
					!url.hash &&
					(!url.port || url.port === "443") &&
					!/\r|\n/.test(value)
				);
			} catch {
				return false;
			}
		}, "Use a public HTTPS Git URL without credentials or a custom port."),
	request: z.string().trim().min(20).max(5000),
});

export const bantuTaskIdInput = z.object({ id: z.string().min(1).max(80) });

export const approveBantuTaskInput = bantuTaskIdInput.extend({
	confirmRepositoryRights: z.literal(true),
});

export const bantuTaskOutput = z.object({
	id: z.string(),
	repository: z.string(),
	request: z.string(),
	status: bantuTaskStatus,
	branch: z.string().nullable(),
	report: z.string().nullable(),
	failure: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	createdBy: z.string(),
});

export const bantuTaskListOutput = z.object({
	tasks: z.array(bantuTaskOutput),
	canApprove: z.boolean(),
	workerConfigured: z.boolean(),
});

export const bantuClaimInput = z.object({
	workerId: z.string().min(1).max(100),
});

export const bantuHeartbeatInput = bantuClaimInput;

export const bantuCompleteInput = bantuClaimInput.extend({
	status: z.enum(["DONE", "FAILED", "PAUSED"]),
	branch: z.string().max(160).nullable(),
	report: z.string().max(30_000).nullable(),
	failure: z.string().max(2000).nullable(),
});

export type CreateBantuTaskInput = z.infer<typeof createBantuTaskInput>;
export type BantuTask = z.infer<typeof bantuTaskOutput>;
export type BantuClaimInput = z.infer<typeof bantuClaimInput>;
export type BantuHeartbeatInput = z.infer<typeof bantuHeartbeatInput>;
export type BantuCompleteInput = z.infer<typeof bantuCompleteInput>;
