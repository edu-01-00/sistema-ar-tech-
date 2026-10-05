import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { nextSequenceNumber } from "@/lib/services/sequence";
import { formatProductiveProcessCode, formatServiceOrderCode } from "@/lib/productive-process-logic";

export const productiveProcessDetailInclude = {
  proposal: { include: { client: true } },
  collectionPoint: true,
  createdBy: { select: { id: true, name: true } },
  serviceOrders: {
    include: {
      createdBy: { select: { id: true, name: true } },
      items: { include: { proposalTest: { include: { test: true } } } },
    },
    orderBy: { sequenceInProcess: "asc" },
  },
} satisfies Prisma.ProductiveProcessInclude;

export type ProductiveProcessWithDetails = Prisma.ProductiveProcessGetPayload<{ include: typeof productiveProcessDetailInclude }>;

// Gera um Processo Produtivo a partir de uma proposta APROVADA, para UM
// ponto de coleta selecionado pelo usuário (nunca para todos os pontos de
// uma vez). Numeração sequencial anual (PP 001/2026), reiniciada a cada ano
// — reaproveita o contador genérico `Sequence` (chave "PP_<ano>"), com o
// mesmo padrão atômico (UPSERT) já usado em proposal-service.ts/epi-service.ts.
export async function createProductiveProcess(userId: string, input: { proposalId: string; collectionPointId: string }) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: input.proposalId },
    include: { collectionPoints: true },
  });
  if (!proposal) throw new ApiError("Proposta não encontrada.", 404);
  if (proposal.status !== "APROVADA") {
    throw new ApiError("Só é possível gerar Processo Produtivo para uma proposta aprovada.", 409);
  }

  const belongsToProposal = proposal.collectionPoints.some((cp) => cp.collectionPointId === input.collectionPointId);
  if (!belongsToProposal) {
    throw new ApiError("O ponto de coleta selecionado não pertence a esta proposta.", 422);
  }

  const id = randomUUID();
  const year = new Date().getFullYear();

  const created = await prisma.$transaction(async (tx) => {
    const sequenceNumber = await nextSequenceNumber(tx, `PP_${year}`);
    const code = formatProductiveProcessCode(sequenceNumber, year);

    const productiveProcess = await tx.productiveProcess.create({
      data: {
        id,
        code,
        sequenceNumber,
        year,
        proposalId: input.proposalId,
        collectionPointId: input.collectionPointId,
        createdById: userId,
      },
    });

    await writeAuditLog(
      {
        userId,
        action: "CREATE",
        entityType: "ProductiveProcess",
        entityId: id,
        description: `Processo Produtivo ${code} criado a partir da proposta ${proposal.code}.`,
      },
      tx,
    );

    return productiveProcess;
  });

  return created;
}

// Gera uma Ordem de Serviço a partir de um Processo Produtivo, com os
// parâmetros/ensaios selecionados (e a quantidade de cada um) entre os que
// já estão vinculados ao ponto de coleta/proposta de origem — nunca uma
// lista independente. Um mesmo Processo Produtivo pode gerar mais de uma
// Ordem de Serviço; a numeração "_1", "_2"... é controlada atomicamente via
// UPDATE ... RETURNING no próprio registro do Processo Produtivo.
export async function createServiceOrder(userId: string, productiveProcessId: string, items: { proposalTestId: string; quantity: number }[]) {
  if (items.length === 0) {
    throw new ApiError("Selecione ao menos um parâmetro para gerar a Ordem de Serviço.", 422);
  }

  const productiveProcess = await prisma.productiveProcess.findUnique({ where: { id: productiveProcessId } });
  if (!productiveProcess) throw new ApiError("Processo Produtivo não encontrado.", 404);

  const proposalTestIds = items.map((i) => i.proposalTestId);
  const proposalTests = await prisma.proposalTest.findMany({ where: { id: { in: proposalTestIds } } });
  if (proposalTests.length !== new Set(proposalTestIds).size) {
    throw new ApiError("Um ou mais parâmetros selecionados não foram encontrados.", 404);
  }
  const invalid = proposalTests.some(
    (pt) => pt.proposalId !== productiveProcess.proposalId || pt.collectionPointId !== productiveProcess.collectionPointId,
  );
  if (invalid) {
    throw new ApiError("Um ou mais parâmetros selecionados não pertencem a este Processo Produtivo.", 422);
  }

  const id = randomUUID();

  const created = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ lastServiceOrderNumber: number }[]>`
      UPDATE "productive_processes"
      SET "lastServiceOrderNumber" = "lastServiceOrderNumber" + 1
      WHERE "id" = ${productiveProcessId}
      RETURNING "lastServiceOrderNumber"
    `;
    const sequenceInProcess = rows[0].lastServiceOrderNumber;
    const code = formatServiceOrderCode(productiveProcess.sequenceNumber, productiveProcess.year, sequenceInProcess);

    const serviceOrder = await tx.serviceOrder.create({
      data: {
        id,
        code,
        sequenceInProcess,
        productiveProcessId,
        createdById: userId,
        items: { create: items.map((i) => ({ proposalTestId: i.proposalTestId, quantity: i.quantity })) },
      },
    });

    await writeAuditLog(
      {
        userId,
        action: "CREATE",
        entityType: "ServiceOrder",
        entityId: id,
        description: `Ordem de Serviço ${code} criada a partir do Processo Produtivo ${productiveProcess.code}.`,
      },
      tx,
    );

    return serviceOrder;
  });

  return created;
}
