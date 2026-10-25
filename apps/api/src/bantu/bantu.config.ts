const MINUTE_MS = 60_000;

export const BANTU_TASK = {
	leaseMs: 3 * MINUTE_MS,
	maxReportChars: 30_000,
	maxTasks: 100,
} as const;
