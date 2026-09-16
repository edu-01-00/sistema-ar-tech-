import type { Prisma, PrismaClient } from "@prisma/client";
import { nextSequenceNumber } from "@/lib/services/sequence";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function generateEpiOrderCode(client: DbClient): Promise<string> {
  const number = await nextSequenceNumber(client, "EPI_ORDER");
  return `OS-EPI-${String(number).padStart(4, "0")}`;
}
