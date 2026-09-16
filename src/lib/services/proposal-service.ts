import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import {
  computeProposalTotal,
  formatProposalCode,
  isValidStatusTransition,
  nextRevisionCode,
  type ProposalStatusValue,
} from "@/lib/proposal-logic";
import type { CreateProposalInput } from "@/lib/validations/proposal";

type TxClient = Prisma.TransactionClient;

export const proposalDetailInclude = {
  client: true,
  createdBy: { select: { id: true, name: true } },
  matrices: true,
  contacts: { include: { clientContact: true } },
  collectionPoints: { include: { collectionPoint: { include: { airQualityDetail: true } } } },
  tests: { include: { test: true, collectionPoint: true } },
  costs: true,
  texts: true,
  statusHistory: { include: { changedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ProposalInclude;

export type ProposalWithDetails = Prisma.ProposalGetPayload<{ include: typeof proposalDetailInclude }>;

// Aloca o próximo número sequencial do ano de forma segura para concorrência:
// o UPSERT com ON CONFLICT é atômico no PostgreSQL (lock implícito de linha),
// então duas transações concorrentes nunca recebem o mesmo número.
async function allocateSequenceNumber(tx: TxClient, year: number): Promise<number> {
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "proposal_sequences" ("year", "lastNumber")
    VALUES (${year}, 1)
    ON CONFLICT ("year")
    DO UPDATE SET "lastNumber" = "proposal_sequences"."lastNumber" + 1
    RETURNING "lastNumber"
  `;
  return rows[0].lastNumber;
}

export function assertProposalEditable(status: ProposalStatusValue | string, supersededAt: Date | null) {
  if (supersededAt) {
    throw new ApiError("Esta revisão foi substituída por uma mais recente e não pode ser editada.", 409);
  }
  if (status !== "EM_ELABORACAO") {
    throw new ApiError("A proposta só pode ser editada enquanto estiver em elaboração. Crie uma revisão para alterá-la.", 409);
  }
}

export async function recalculateProposalTotals(tx: TxClient, proposalId: string) {
  const proposal = await tx.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    include: { tests: true, costs: true },
  });

  const totals = computeProposalTotal({
    tests: proposal.tests.map((t) => ({ quantity: t.quantity, value: Number(t.valueSnapshot) })),
    costs: proposal.costs.map((c) => ({ value: Number(c.value) })),
    travel: {
      distanceKm: proposal.travelDistanceKm ? Number(proposal.travelDistanceKm) : null,
      valuePerKm: proposal.travelValuePerKm ? Number(proposal.travelValuePerKm) : null,
      otherCosts: proposal.travelOtherCosts ? Number(proposal.travelOtherCosts) : null,
    },
  });

  await tx.proposal.update({
    where: { id: proposalId },
    data: {
      testsTotal: totals.testsTotal,
      otherCostsTotal: totals.otherCostsTotal,
      travelTotalValue: totals.travelTotal,
      totalValue: totals.totalValue,
    },
  });

  return totals;
}

export async function createProposal(userId: string, input: CreateProposalInput) {
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client || !client.active) {
    throw new ApiError("Cliente não encontrado ou inativo.", 404);
  }

  if (input.contactIds.length > 0) {
    const contacts = await prisma.clientContact.findMany({ where: { id: { in: input.contactIds } } });
    if (contacts.length !== input.contactIds.length) {
      throw new ApiError("Um ou mais solicitantes não foram encontrados.", 404);
    }
    const invalid = contacts.some((c) => c.clientId !== input.clientId);
    if (invalid) {
      throw new ApiError("Não é permitido selecionar um contato de outro cliente.", 422);
    }
  }

  const id = randomUUID();
  const year = new Date().getFullYear();

  const proposal = await prisma.$transaction(async (tx) => {
    const sequenceNumber = await allocateSequenceNumber(tx, year);
    const code = formatProposalCode(sequenceNumber, year, 0);

    const created = await tx.proposal.create({
      data: {
        id,
        rootId: id,
        code,
        sequenceNumber,
        year,
        revision: 0,
        status: "EM_ELABORACAO",
        clientId: input.clientId,
        createdById: userId,
        matrices: { create: input.matrices.map((matrix) => ({ matrix })) },
        contacts: { create: input.contactIds.map((clientContactId) => ({ clientContactId })) },
      },
    });

    const baseTexts = await tx.technicalText.findMany({ where: { matrix: { in: input.matrices } } });
    if (baseTexts.length > 0) {
      await tx.proposalText.createMany({
        data: baseTexts.map((t) => ({ proposalId: id, matrix: t.matrix, content: t.content })),
      });
    }

    await writeAuditLog(
      {
        userId,
        action: "CREATE",
        entityType: "Proposal",
        entityId: id,
        description: `Proposta ${code} criada.`,
      },
      tx,
    );

    return created;
  });

  return proposal;
}

export async function createProposalRevision(userId: string, proposalId: string) {
  const current = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      matrices: true,
      contacts: true,
      collectionPoints: true,
      tests: true,
      costs: true,
      texts: true,
    },
  });

  if (!current) throw new ApiError("Proposta não encontrada.", 404);
  if (current.supersededAt) {
    throw new ApiError("Esta revisão já foi substituída por outra mais recente.", 409);
  }

  const { revision, code } = nextRevisionCode(current.sequenceNumber, current.year, current.revision);
  const newId = randomUUID();

  const revised = await prisma.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: current.id },
      data: { supersededAt: new Date() },
    });

    const created = await tx.proposal.create({
      data: {
        id: newId,
        rootId: current.rootId,
        code,
        sequenceNumber: current.sequenceNumber,
        year: current.year,
        revision,
        status: "EM_ELABORACAO",
        clientId: current.clientId,
        createdById: userId,
        paymentMethod: current.paymentMethod,
        installments: current.installments,
        additionalInfo: current.additionalInfo,
        travelDistanceKm: current.travelDistanceKm,
        travelValuePerKm: current.travelValuePerKm,
        travelOtherCosts: current.travelOtherCosts,
        travelTotalValue: current.travelTotalValue,
        testsTotal: current.testsTotal,
        otherCostsTotal: current.otherCostsTotal,
        totalValue: current.totalValue,
        matrices: { create: current.matrices.map((m) => ({ matrix: m.matrix })) },
        contacts: { create: current.contacts.map((c) => ({ clientContactId: c.clientContactId })) },
        collectionPoints: { create: current.collectionPoints.map((cp) => ({ collectionPointId: cp.collectionPointId })) },
        tests: {
          create: current.tests.map((t) => ({
            testId: t.testId,
            collectionPointId: t.collectionPointId,
            nameSnapshot: t.nameSnapshot,
            methodSnapshot: t.methodSnapshot,
            unitSnapshot: t.unitSnapshot,
            codeSnapshot: t.codeSnapshot,
            valueSnapshot: t.valueSnapshot,
            quantity: t.quantity,
          })),
        },
        costs: { create: current.costs.map((c) => ({ description: c.description, value: c.value, type: c.type })) },
        texts: { create: current.texts.map((t) => ({ matrix: t.matrix, content: t.content })) },
      },
    });

    await writeAuditLog(
      {
        userId,
        action: "REVISION",
        entityType: "Proposal",
        entityId: newId,
        description: `Revisão ${code} criada a partir de ${current.code}.`,
        metadata: { previousProposalId: current.id },
      },
      tx,
    );

    return created;
  });

  return revised;
}

export async function changeProposalStatus(userId: string, proposalId: string, newStatus: ProposalStatusValue) {
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw new ApiError("Proposta não encontrada.", 404);
  if (proposal.supersededAt) {
    throw new ApiError("Esta revisão foi substituída e não pode ter o status alterado.", 409);
  }
  if (!isValidStatusTransition(proposal.status as ProposalStatusValue, newStatus)) {
    throw new ApiError(`Não é possível alterar o status de "${proposal.status}" para "${newStatus}".`, 422);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.proposal.update({ where: { id: proposalId }, data: { status: newStatus } });
    await tx.proposalStatusHistory.create({
      data: { proposalId, status: newStatus, changedById: userId },
    });
    await writeAuditLog(
      {
        userId,
        action: "STATUS_CHANGE",
        entityType: "Proposal",
        entityId: proposalId,
        description: `Status da proposta ${proposal.code} alterado de ${proposal.status} para ${newStatus}.`,
      },
      tx,
    );
    return result;
  });

  return updated;
}
