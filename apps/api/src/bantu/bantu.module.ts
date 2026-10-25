import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { BantuRouter } from "./bantu.router";
import { BantuService } from "./bantu.service";
import { BantuWorkerController } from "./bantu-worker.controller";

@Module({
	imports: [TrpcModule],
	controllers: [BantuWorkerController],
	providers: [BantuRouter, BantuService],
})
export class BantuModule {}
