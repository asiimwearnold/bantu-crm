import { Inject } from "@nestjs/common";
import {
	Ctx,
	Input,
	Mutation,
	Query,
	Router,
	UseMiddlewares,
} from "nestjs-trpc";
import type { z } from "zod";
import type { AuthedTrpcContext } from "../trpc/context.types";
import { AuthMiddleware } from "../trpc/middlewares/auth.middleware";
import { restMeta } from "../trpc/openapi";
import {
	approveBantuTaskInput,
	bantuTaskIdInput,
	bantuTaskListOutput,
	bantuTaskOutput,
	createBantuTaskInput,
} from "./bantu.contracts";
import { BantuService } from "./bantu.service";

@Router({ alias: "bantu" })
@UseMiddlewares(AuthMiddleware)
export class BantuRouter {
	constructor(@Inject(BantuService) private readonly bantu: BantuService) {}

	@Query({
		output: bantuTaskListOutput,
		meta: restMeta("GET", "/bantu/tasks", ["BANTU"]),
	})
	async list(@Ctx() ctx: AuthedTrpcContext) {
		return this.bantu.list(ctx.user.id);
	}

	@Mutation({
		input: createBantuTaskInput,
		output: bantuTaskOutput,
		meta: restMeta("POST", "/bantu/tasks", ["BANTU"]),
	})
	async create(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof createBantuTaskInput>,
	) {
		return this.bantu.create(ctx.user.id, input);
	}

	@Mutation({
		input: approveBantuTaskInput,
		output: bantuTaskOutput,
		meta: restMeta("POST", "/bantu/tasks/{id}/approve", ["BANTU"]),
	})
	async approve(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof approveBantuTaskInput>,
	) {
		return this.bantu.approve(
			ctx.user.id,
			input.id,
			input.confirmRepositoryRights,
		);
	}

	@Mutation({
		input: bantuTaskIdInput,
		output: bantuTaskOutput,
		meta: restMeta("POST", "/bantu/tasks/{id}/retry", ["BANTU"]),
	})
	async retry(
		@Ctx() ctx: AuthedTrpcContext,
		@Input() input: z.infer<typeof bantuTaskIdInput>,
	) {
		return this.bantu.retry(ctx.user.id, input.id);
	}
}
