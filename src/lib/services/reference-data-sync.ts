import type { Prisma } from "@prisma/client";
import { PROPOSAL_TEXT_DEFAULTS } from "@/lib/proposal-text-defaults";

type TxClient = Prisma.TransactionClient | typeof import("@/lib/prisma").prisma;

// Unidades de medida já em uso pelos ensaios/legislações cadastrados
// originalmente no seed. Novas unidades podem ser adicionadas depois pela
// tela de cadastro — isto aqui é apenas a carga inicial do catálogo.
const INITIAL_MEASUREMENT_UNITS = ["mg/Nm³", "ppm", "µg/m³", "dB(A)"];

// Sincroniza o catálogo de unidades de medida e os textos padrão de proposta.
// Idempotente: pode ser executado repetidamente (inclusive em produção, após
// a criação inicial da empresa) sem duplicar registros nem sobrescrever
// edições já feitas pelo usuário nos textos padrão.
export async function syncReferenceData(tx: TxClient) {
  for (const name of INITIAL_MEASUREMENT_UNITS) {
    await tx.measurementUnit.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const def of PROPOSAL_TEXT_DEFAULTS) {
    // Upsert por chave composta não funciona quando `matrix` é null (Postgres
    // permite múltiplos NULLs em índice único), então buscamos manualmente.
    const existing = await tx.proposalTextTemplate.findFirst({
      where: { category: def.category, matrix: def.matrix },
    });
    if (!existing) {
      await tx.proposalTextTemplate.create({
        data: {
          category: def.category,
          matrix: def.matrix,
          name: def.name,
          content: def.content,
          order: def.order,
        },
      });
    }
  }
}
