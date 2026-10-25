import {
	BadRequestException,
	Body,
	Controller,
	ForbiddenException,
	Headers,
	Param,
	Post,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { EnvironmentVariables } from "../config/env.validation";
import {
	bantuClaimInput,
	bantuCompleteInput,
	bantuHeartbeatInput,
} from "./bantu.contracts";
import { BantuService } from "./bantu.service";

@ApiExcludeController()
@Controller("internal/bantu")
export class BantuWorkerController {
	private readonly token: string | undefined;

	constructor(
		private readonly bantu: BantuService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.token = config.get("BANTU_WORKER_TOKEN", { infer: true })?.trim();
	}

	@Post("tasks/claim")
	@AllowAnonymous()
	async claim(
		@Headers("authorization") authorization: string | undefined,
		@Body() body: unknown,
	) {
		this.authorize(authorization);
		const input = bantuClaimInput.safeParse(body);
		if (!input.success)
			throw new BadRequestException("Invalid BANTU worker claim.");
		return { task: await this.bantu.claim(input.data.workerId) };
	}

	@Post("tasks/:id/heartbeat")
	@AllowAnonymous()
	async heartbeat(
		@Headers("authorization") authorization: string | undefined,
		@Param("id") id: string,
		@Body() body: unknown,
	) {
		this.authorize(authorization);
		const input = bantuHeartbeatInput.safeParse(body);
		if (!input.success)
			throw new BadRequestException("Invalid BANTU worker heartbeat.");
		return this.bantu.heartbeat(id, input.data.workerId);
	}

	@Post("tasks/:id/complete")
	@AllowAnonymous()
	async complete(
		@Headers("authorization") authorization: string | undefined,
		@Param("id") id: string,
		@Body() body: unknown,
	) {
		this.authorize(authorization);
		const input = bantuCompleteInput.safeParse(body);
		if (!input.success)
			throw new BadRequestException("Invalid BANTU worker result.");
		return this.bantu.complete(id, input.data.workerId, input.data);
	}

	private authorize(authorization: string | undefined) {
		if (!this.token) {
			throw new ServiceUnavailableException(
				"The BANTU worker is not configured.",
			);
		}
		if (!timingSafeEquals(authorization ?? "", `Bearer ${this.token}`)) {
			throw new ForbiddenException();
		}
	}
}

function timingSafeEquals(left: string, right: string): boolean {
	if (left.length !== right.length) return false;
	let mismatch = 0;
	for (let index = 0; index < left.length; index += 1) {
		mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return mismatch === 0;
}
