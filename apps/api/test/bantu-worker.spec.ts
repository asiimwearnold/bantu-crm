import { describe, expect, it } from "bun:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createBantuTaskInput } from "../src/bantu/bantu.contracts";
import type { BantuService } from "../src/bantu/bantu.service";
import { BantuWorkerController } from "../src/bantu/bantu-worker.controller";
import type { EnvironmentVariables } from "../src/config/env.validation";

const token = "t".repeat(32);

function controller(
	service: Pick<BantuService, "claim"> = { claim: async () => null },
) {
	const config = new ConfigService({
		BANTU_WORKER_TOKEN: token,
	}) as ConfigService<EnvironmentVariables, true>;
	return new BantuWorkerController(service as BantuService, config);
}

describe("BANTU worker controller", () => {
	it("accepts the configured bearer token", async () => {
		const claimed: string[] = [];
		const route = controller({
			claim: async (workerId: string) => {
				claimed.push(workerId);
				return null;
			},
		});

		await expect(
			route.claim(`Bearer ${token}`, { workerId: "worker-1" }),
		).resolves.toEqual({ task: null });
		expect(claimed).toEqual(["worker-1"]);
	});

	it("rejects invalid worker credentials", async () => {
		const route = controller();

		await expect(
			route.claim("Bearer invalid", { workerId: "worker-1" }),
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("rejects malformed worker payloads", async () => {
		const route = controller();

		await expect(
			route.claim(`Bearer ${token}`, { workerId: "" }),
		).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe("BANTU task input", () => {
	it("accepts public HTTPS repository URLs", () => {
		expect(
			createBantuTaskInput.safeParse({
				repository: "https://github.com/team/project.git",
				request: "Add a unit test and verify the expected behavior.",
			}).success,
		).toBe(true);
	});

	it("rejects credentials, custom ports, and non-HTTPS URLs", () => {
		for (const repository of [
			"https://user:password@github.com/team/project.git",
			"https://github.com:8443/team/project.git",
			"http://github.com/team/project.git",
		]) {
			expect(
				createBantuTaskInput.safeParse({
					repository,
					request: "Add a unit test and verify the expected behavior.",
				}).success,
			).toBe(false);
		}
	});
});
