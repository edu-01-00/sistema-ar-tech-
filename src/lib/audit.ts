import { prisma } from "@/lib/prisma";
import { Prisma, type PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function writeAuditLog(
  params: {
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    description: string;
    metadata?: Record<string, unknown>;
  },
  client: DbClient = prisma,
) {
  await client.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
