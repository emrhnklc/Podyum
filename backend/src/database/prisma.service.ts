import { Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "../generated/prisma/client.js";
import { assertProjectDatabase } from "./assert-database-target.js";
import { createPrismaAdapter } from "./prisma-client.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  constructor() {
    super({ adapter: createPrismaAdapter() });
  }

  async onModuleInit() {
    await assertProjectDatabase();
    await this.$connect();
  }

  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
