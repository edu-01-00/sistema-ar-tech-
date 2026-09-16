import type { Prisma, PrismaClient } from "@prisma/client";
import { nextSequenceNumber } from "@/lib/services/sequence";

type DbClient = PrismaClient | Prisma.TransactionClient;

const MATRIX_PREFIX: Record<string, string> = {
  EMISSOES_ATMOSFERICAS: "EA",
  QUALIDADE_AR: "QA",
  RUIDO_AMBIENTAL: "RA",
};

// Gera um código único e sequencial para o parâmetro do ensaio, prefixado
// pela matriz (ex: EA-0001, QA-0001, RA-0001). Nunca é digitado manualmente.
export async function generateParameterCode(client: DbClient, matrix: string): Promise<string> {
  const prefix = MATRIX_PREFIX[matrix] ?? "GE";
  const number = await nextSequenceNumber(client, `TEST_${matrix}`);
  return `${prefix}-${String(number).padStart(4, "0")}`;
}
