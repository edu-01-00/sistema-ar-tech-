import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

// Incrementa e retorna o próximo número de uma sequência nomeada, de forma
// atômica (UPSERT com ON CONFLICT), segura mesmo com múltiplas requisições
// simultâneas tentando gerar um código ao mesmo tempo.
export async function nextSequenceNumber(client: DbClient, key: string): Promise<number> {
  const rows = await client.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "sequences" ("key", "lastNumber")
    VALUES (${key}, 1)
    ON CONFLICT ("key")
    DO UPDATE SET "lastNumber" = "sequences"."lastNumber" + 1
    RETURNING "lastNumber"
  `;
  return rows[0].lastNumber;
}
