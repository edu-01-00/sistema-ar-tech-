import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { nextSequenceNumber } from "@/lib/services/sequence";
import {
  formatProductiveProcessCode,
  formatServiceOrderCode,
  isValidProductiveProcessStatusTransition,
  type ProductiveProcessStatusValue,
} from "@/lib/productive-process-logic";

type TxClient = Prisma.TransactionClient;

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
  samplingPlan: {
    include: {
      fieldResponsible: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      equipmentChecks: { include: { equipment: true } },
    },
  },
  custodyEntry: { include: { receivedBy: { select: { id: true, name: true } } } },
  sampleAcceptance: { include: { acceptedBy: { select: { id: true, name: true } } } },
  resultWorksheet: {
    include: {
      analyzedBy: { select: { id: true, name: true } },
      validatedBy: { select: { id: true, name: true } },
      gravimetry: true,
      acoustic: true,
    },
  },
} satisfies Prisma.ProductiveProcessInclude;

export type ProductiveProcessWithDetails = Prisma.ProductiveProcessGetPayload<{ include: typeof productiveProcessDetailInclude }>;

async function createProductiveProcessInTx(
  tx: TxClient,
  userId: string,
  input: { proposalId: string; collectionPointId: string },
) {
  const id = randomUUID();
  const year = new Date().getFullYear();
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
      description: `Processo Produtivo ${code} criado.`,
    },
    tx,
  );

  return productiveProcess;
}

async function createServiceOrderInTx(
  tx: TxClient,
  userId: string,
  productiveProcess: { id: string; code: string; sequenceNumber: number; year: number },
  items: { proposalTestId: string; quantity: number }[],
) {
  const id = randomUUID();
  const rows = await tx.$queryRaw<{ lastServiceOrderNumber: number }[]>`
    UPDATE "productive_processes"
    SET "lastServiceOrderNumber" = "lastServiceOrderNumber" + 1
    WHERE "id" = ${productiveProcess.id}
    RETURNING "lastServiceOrderNumber"
  `;
  const sequenceInProcess = rows[0].lastServiceOrderNumber;
  const code = formatServiceOrderCode(productiveProcess.sequenceNumber, productiveProcess.year, sequenceInProcess);

  const serviceOrder = await tx.serviceOrder.create({
    data: {
      id,
      code,
      sequenceInProcess,
      productiveProcessId: productiveProcess.id,
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
}

// Gera um Processo Produtivo a partir de uma proposta APROVADA, para UM
// ponto de coleta selecionado pelo usuário. Numeração sequencial anual
// (PP 001/2026), reiniciada a cada ano — reaproveita o contador genérico
// `Sequence` (chave "PP_<ano>"), com o mesmo padrão atômico (UPSERT) já
// usado em proposal-service.ts/epi-service.ts.
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

  return prisma.$transaction((tx) => createProductiveProcessInTx(tx, userId, input));
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

  return prisma.$transaction((tx) => createServiceOrderInTx(tx, userId, productiveProcess, items));
}

// Campanha de Monitoramento: ao aprovar uma proposta, gera automaticamente
// 1 Processo Produtivo + 1 Ordem de Serviço (com TODOS os ensaios
// contratados naquele ponto, na quantidade contratada) para CADA ponto de
// coleta da proposta — nunca duplicando um Processo Produtivo já existente
// para o mesmo ponto (idempotente, chamada dentro da mesma transação de
// changeProposalStatus). As telas manuais de gerar PP/OS continuam
// disponíveis para ajustes pontuais depois.
export async function generateCampaignExecution(tx: TxClient, userId: string, proposalId: string) {
  const proposal = await tx.proposal.findUniqueOrThrow({
    where: { id: proposalId },
    include: { collectionPoints: true, tests: true },
  });

  const existingProcesses = await tx.productiveProcess.findMany({ where: { proposalId }, select: { collectionPointId: true } });
  const existingPointIds = new Set(existingProcesses.map((p) => p.collectionPointId));

  for (const cp of proposal.collectionPoints) {
    if (existingPointIds.has(cp.collectionPointId)) continue;

    const productiveProcess = await createProductiveProcessInTx(tx, userId, {
      proposalId,
      collectionPointId: cp.collectionPointId,
    });

    const pointTests = proposal.tests.filter((t) => t.collectionPointId === cp.collectionPointId);
    if (pointTests.length === 0) continue;

    await createServiceOrderInTx(
      tx,
      userId,
      productiveProcess,
      pointTests.map((t) => ({ proposalTestId: t.id, quantity: t.quantity })),
    );
  }
}

function assertStatus(current: ProductiveProcessStatusValue, expected: ProductiveProcessStatusValue, actionDescription: string) {
  if (current !== expected) {
    throw new ApiError(`Não é possível ${actionDescription}: o processo está em "${current}", esperado "${expected}".`, 409);
  }
}

// Transição explícita de status, disparada por uma ação direta do usuário
// (as demais transições acontecem como efeito colateral de registrar os
// dados de cada fase — ver as funções abaixo).
export async function transitionProductiveProcessStatus(userId: string, productiveProcessId: string, newStatus: ProductiveProcessStatusValue) {
  const productiveProcess = await prisma.productiveProcess.findUnique({
    where: { id: productiveProcessId },
    include: { resultWorksheet: { include: { gravimetry: true, acoustic: true } }, collectionPoint: true },
  });
  if (!productiveProcess) throw new ApiError("Processo Produtivo não encontrado.", 404);

  const current = productiveProcess.status as ProductiveProcessStatusValue;
  if (!isValidProductiveProcessStatusTransition(current, newStatus)) {
    throw new ApiError(`Não é possível alterar o status de "${current}" para "${newStatus}".`, 422);
  }

  if (newStatus === "VALIDADO") {
    const worksheet = productiveProcess.resultWorksheet;
    if (!worksheet) throw new ApiError("Preencha a folha de resultados antes de validar.", 422);
    const matrix = productiveProcess.collectionPoint.matrix;
    if (matrix === "RUIDO_AMBIENTAL") {
      if (!worksheet.acoustic || worksheet.acoustic.leqDba === null) {
        throw new ApiError("Preencha ao menos o Leq antes de validar os resultados.", 422);
      }
    } else {
      if (!worksheet.gravimetry || worksheet.gravimetry.labReadingValue === null) {
        throw new ApiError("Preencha ao menos a leitura de laboratório antes de validar os resultados.", 422);
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const updateData: Prisma.ProductiveProcessUpdateInput = { status: newStatus };
    const updated = await tx.productiveProcess.update({ where: { id: productiveProcessId }, data: updateData });

    if (newStatus === "VALIDADO") {
      await tx.resultWorksheet.update({
        where: { productiveProcessId },
        data: { validatedById: userId, validatedAt: new Date() },
      });
    }

    await writeAuditLog(
      {
        userId,
        action: "STATUS_CHANGE",
        entityType: "ProductiveProcess",
        entityId: productiveProcessId,
        description: `Status do Processo Produtivo ${productiveProcess.code} alterado de ${current} para ${newStatus}.`,
      },
      tx,
    );

    return updated;
  });
}

// Fase 1 — Plano de Amostragem: agendamento + checklist de equipamentos.
// Avança PLANEJADO -> AGENDADO na primeira vez que é registrado.
export async function createOrUpdateSamplingPlan(
  userId: string,
  productiveProcessId: string,
  input: { scheduledAt: Date; fieldResponsibleId: string; notes?: string | null; equipmentIds: string[] },
) {
  const productiveProcess = await prisma.productiveProcess.findUnique({ where: { id: productiveProcessId } });
  if (!productiveProcess) throw new ApiError("Processo Produtivo não encontrado.", 404);

  const current = productiveProcess.status as ProductiveProcessStatusValue;
  if (current !== "PLANEJADO" && current !== "AGENDADO") {
    throw new ApiError(`Não é possível editar o plano de amostragem: o processo está em "${current}".`, 409);
  }

  const equipment = input.equipmentIds.length
    ? await prisma.equipment.findMany({ where: { id: { in: input.equipmentIds } } })
    : [];
  if (equipment.length !== input.equipmentIds.length) {
    throw new ApiError("Um ou mais equipamentos selecionados não foram encontrados.", 404);
  }

  return prisma.$transaction(async (tx) => {
    const plan = await tx.samplingPlan.upsert({
      where: { productiveProcessId },
      create: {
        productiveProcessId,
        scheduledAt: input.scheduledAt,
        fieldResponsibleId: input.fieldResponsibleId,
        notes: input.notes || null,
        createdById: userId,
      },
      update: {
        scheduledAt: input.scheduledAt,
        fieldResponsibleId: input.fieldResponsibleId,
        notes: input.notes || null,
      },
    });

    await tx.samplingPlanEquipment.deleteMany({ where: { samplingPlanId: plan.id } });
    if (equipment.length > 0) {
      await tx.samplingPlanEquipment.createMany({
        data: equipment.map((eq) => ({
          samplingPlanId: plan.id,
          equipmentId: eq.id,
          // Snapshot: a validade registrada aqui nunca muda se a calibração
          // do equipamento for atualizada depois (rastreabilidade ISO 17025).
          calibrationValidUntilSnapshot: eq.calibrationValidUntil,
        })),
      });
    }

    if (current === "PLANEJADO") {
      await tx.productiveProcess.update({ where: { id: productiveProcessId }, data: { status: "AGENDADO" } });
    }

    await writeAuditLog(
      {
        userId,
        action: current === "PLANEJADO" ? "CREATE" : "UPDATE",
        entityType: "SamplingPlan",
        entityId: plan.id,
        description: `Plano de amostragem do Processo Produtivo ${productiveProcess.code} registrado.`,
      },
      tx,
    );

    return plan;
  });
}

// Fase 2 — Entrada e Custódia: exige coleta em campo já concluída
// (EM_CAMPO). Avança EM_CAMPO -> RECEBIDO_CUSTODIA.
export async function createOrUpdateCustodyEntry(
  userId: string,
  productiveProcessId: string,
  input: { arrivedAt: Date; weatherConditions?: string | null; temperatureC?: number | null; humidityPercent?: number | null },
) {
  const productiveProcess = await prisma.productiveProcess.findUnique({ where: { id: productiveProcessId } });
  if (!productiveProcess) throw new ApiError("Processo Produtivo não encontrado.", 404);

  const current = productiveProcess.status as ProductiveProcessStatusValue;
  if (current !== "EM_CAMPO" && current !== "RECEBIDO_CUSTODIA") {
    throw new ApiError(`Não é possível registrar a entrada e custódia: o processo está em "${current}", esperado "EM_CAMPO".`, 409);
  }

  return prisma.$transaction(async (tx) => {
    const entry = await tx.custodyEntry.upsert({
      where: { productiveProcessId },
      create: {
        productiveProcessId,
        arrivedAt: input.arrivedAt,
        receivedById: userId,
        weatherConditions: input.weatherConditions || null,
        temperatureC: input.temperatureC ?? null,
        humidityPercent: input.humidityPercent ?? null,
      },
      update: {
        arrivedAt: input.arrivedAt,
        weatherConditions: input.weatherConditions || null,
        temperatureC: input.temperatureC ?? null,
        humidityPercent: input.humidityPercent ?? null,
      },
    });

    if (current === "EM_CAMPO") {
      await tx.productiveProcess.update({ where: { id: productiveProcessId }, data: { status: "RECEBIDO_CUSTODIA" } });
    }

    await writeAuditLog(
      {
        userId,
        action: current === "EM_CAMPO" ? "CREATE" : "UPDATE",
        entityType: "CustodyEntry",
        entityId: entry.id,
        description: `Entrada e custódia do Processo Produtivo ${productiveProcess.code} registrada.`,
      },
      tx,
    );

    return entry;
  });
}

// Fase 3 — Checagem e Aceitação: exige amostra já em custódia
// (RECEBIDO_CUSTODIA). Avança para EM_ANALISE (aceita/aceita com
// ressalvas) ou REJEITADO (terminal).
export async function createOrUpdateSampleAcceptance(
  userId: string,
  productiveProcessId: string,
  input: {
    status: "ACEITA" | "ACEITA_COM_RESSALVAS" | "REJEITADA";
    filtersIntegrityOk: boolean;
    sealsIntegrityOk: boolean;
    absorbentSolutionOk: boolean;
    deviationNotes?: string | null;
  },
) {
  if (input.status !== "ACEITA" && !input.deviationNotes?.trim()) {
    throw new ApiError("Informe o motivo da ressalva/rejeição em 'Anomalias ou desvios'.", 422);
  }

  const productiveProcess = await prisma.productiveProcess.findUnique({ where: { id: productiveProcessId } });
  if (!productiveProcess) throw new ApiError("Processo Produtivo não encontrado.", 404);

  const current = productiveProcess.status as ProductiveProcessStatusValue;
  assertStatus(current, "RECEBIDO_CUSTODIA", "registrar a checagem e aceitação");

  const nextStatus: ProductiveProcessStatusValue = input.status === "REJEITADA" ? "REJEITADO" : "EM_ANALISE";

  return prisma.$transaction(async (tx) => {
    const acceptance = await tx.sampleAcceptance.create({
      data: {
        productiveProcessId,
        status: input.status,
        filtersIntegrityOk: input.filtersIntegrityOk,
        sealsIntegrityOk: input.sealsIntegrityOk,
        absorbentSolutionOk: input.absorbentSolutionOk,
        deviationNotes: input.deviationNotes || null,
        acceptedById: userId,
      },
    });

    await tx.productiveProcess.update({ where: { id: productiveProcessId }, data: { status: nextStatus } });

    if (nextStatus === "EM_ANALISE") {
      // Garante que já exista a folha de resultados para a fase seguinte.
      await tx.resultWorksheet.upsert({
        where: { productiveProcessId },
        create: { productiveProcessId },
        update: {},
      });
    }

    await writeAuditLog(
      {
        userId,
        action: "CREATE",
        entityType: "SampleAcceptance",
        entityId: acceptance.id,
        description: `Amostra do Processo Produtivo ${productiveProcess.code} registrada como "${input.status}".`,
      },
      tx,
    );

    return acceptance;
  });
}

// Fase 4 — Resultados (Folha de Trabalho): exige amostra aceita
// (EM_ANALISE). Preenche o detalhe conforme a matriz do ponto de coleta —
// gravimetria para EA/QAR, leituras acústicas para RA.
export async function createOrUpdateResultWorksheet(
  userId: string,
  productiveProcessId: string,
  input: {
    gravimetry?: {
      filterWeightBefore?: number | null;
      filterWeightAfter?: number | null;
      fieldBlankWeight?: number | null;
      labReadingValue?: number | null;
      sampledVolumeM3?: number | null;
    };
    acoustic?: {
      leqDba?: number | null;
      l10Dba?: number | null;
      l90Dba?: number | null;
      backgroundNoiseDba?: number | null;
      measurementMinutes?: number | null;
    };
  },
) {
  const productiveProcess = await prisma.productiveProcess.findUnique({
    where: { id: productiveProcessId },
    include: { collectionPoint: true },
  });
  if (!productiveProcess) throw new ApiError("Processo Produtivo não encontrado.", 404);

  const current = productiveProcess.status as ProductiveProcessStatusValue;
  assertStatus(current, "EM_ANALISE", "editar a folha de resultados");

  const isAcoustic = productiveProcess.collectionPoint.matrix === "RUIDO_AMBIENTAL";
  if (isAcoustic && !input.acoustic) throw new ApiError("Informe as leituras acústicas (matriz Ruído Ambiental).", 422);
  if (!isAcoustic && !input.gravimetry) throw new ApiError("Informe os dados de gravimetria (matriz EA/QAR).", 422);

  return prisma.$transaction(async (tx) => {
    const worksheet = await tx.resultWorksheet.upsert({
      where: { productiveProcessId },
      create: { productiveProcessId, analyzedById: userId, analyzedAt: new Date() },
      update: { analyzedById: userId, analyzedAt: new Date() },
    });

    if (isAcoustic && input.acoustic) {
      await tx.resultWorksheetAcoustic.upsert({
        where: { resultWorksheetId: worksheet.id },
        create: { resultWorksheetId: worksheet.id, ...input.acoustic },
        update: { ...input.acoustic },
      });
    }
    if (!isAcoustic && input.gravimetry) {
      await tx.resultWorksheetGravimetry.upsert({
        where: { resultWorksheetId: worksheet.id },
        create: { resultWorksheetId: worksheet.id, ...input.gravimetry },
        update: { ...input.gravimetry },
      });
    }

    await writeAuditLog(
      {
        userId,
        action: "UPDATE",
        entityType: "ResultWorksheet",
        entityId: worksheet.id,
        description: `Folha de resultados do Processo Produtivo ${productiveProcess.code} atualizada.`,
      },
      tx,
    );

    return tx.resultWorksheet.findUniqueOrThrow({ where: { id: worksheet.id }, include: { gravimetry: true, acoustic: true } });
  });
}
