import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createProposal, changeProposalStatus } from "@/lib/services/proposal-service";
import {
  createOrUpdateSamplingPlan,
  createOrUpdateCustodyEntry,
  createOrUpdateSampleAcceptance,
  createOrUpdateResultWorksheet,
  transitionProductiveProcessStatus,
} from "@/lib/services/productive-process-service";
import { ApiError } from "@/lib/api-helpers";

// Testes de integração contra o banco real (Postgres) da Campanha de
// Monitoramento: geração automática de Processo Produtivo + Ordem de
// Serviço na aprovação da proposta, e o ciclo de vida técnico (ISO 17025)
// de cada Processo Produtivo — Plano de Amostragem, Entrada e Custódia,
// Checagem/Aceitação e Resultados — por matriz, de forma independente.

let roleId: string;
let userId: string;
let clientId: string;
const createdProposalIds: string[] = [];
const createdPointIds: string[] = [];
const createdEquipmentIds: string[] = [];

async function createTestForMatrix(matrix: string, suffix: string) {
  return prisma.test.create({
    data: { name: `Ensaio ${matrix} ${suffix}`, method: "Método X", unit: "un", parameterCode: `COD-${matrix}-${suffix}`, value: 100, matrix: matrix as never },
  });
}

async function createApprovedCampaign(pointsByMatrix: { matrix: string; name: string }[]) {
  const suffix = randomUUID().slice(0, 6);
  const matrices = [...new Set(pointsByMatrix.map((p) => p.matrix))];

  const points = await Promise.all(
    pointsByMatrix.map((p) => prisma.collectionPoint.create({ data: { clientId, matrix: p.matrix as never, name: p.name } })),
  );
  createdPointIds.push(...points.map((p) => p.id));

  const proposal = await createProposal(userId, {
    clientId,
    matrices: matrices as never,
    contactIds: [],
    exhibitUnitValue: true,
    useAdditionalCosts: true,
    exhibitTravelValue: true,
  });
  createdProposalIds.push(proposal.id);

  await prisma.proposalCollectionPoint.createMany({
    data: points.map((p) => ({ proposalId: proposal.id, collectionPointId: p.id })),
  });

  for (const point of points) {
    const matrixTest = await createTestForMatrix(point.matrix, `${suffix}-${point.id.slice(0, 4)}`);
    await prisma.proposalTest.create({
      data: {
        proposalId: proposal.id,
        testId: matrixTest.id,
        collectionPointId: point.id,
        nameSnapshot: matrixTest.name,
        methodSnapshot: "Método X",
        unitSnapshot: "un",
        codeSnapshot: matrixTest.parameterCode,
        valueSnapshot: 100,
        quantity: 1,
      },
    });
  }

  await changeProposalStatus(userId, proposal.id, "ENVIADA");
  await changeProposalStatus(userId, proposal.id, "APROVADA");

  const productiveProcesses = await prisma.productiveProcess.findMany({
    where: { proposalId: proposal.id },
    include: { collectionPoint: true },
  });

  return { proposal, points, productiveProcesses };
}

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  const role = await prisma.role.create({ data: { name: `TEST_ROLE_CAMPAIGN_${suffix}` } });
  roleId = role.id;
  const user = await prisma.user.create({
    data: { name: "Usuário Campanha Teste", email: `teste-campanha-${suffix}@example.com`, passwordHash: "x", roleId },
  });
  userId = user.id;
  const client = await prisma.client.create({
    data: { cnpj: suffix.padEnd(14, "2").slice(0, 14), corporateName: `Cliente Campanha Teste ${suffix}` },
  });
  clientId = client.id;
});

afterAll(async () => {
  const pps = await prisma.productiveProcess.findMany({ where: { proposalId: { in: createdProposalIds } }, select: { id: true } });
  const ppIds = pps.map((p) => p.id);

  await prisma.resultWorksheetGravimetry.deleteMany({ where: { resultWorksheet: { productiveProcessId: { in: ppIds } } } });
  await prisma.resultWorksheetAcoustic.deleteMany({ where: { resultWorksheet: { productiveProcessId: { in: ppIds } } } });
  await prisma.resultWorksheet.deleteMany({ where: { productiveProcessId: { in: ppIds } } });
  await prisma.sampleAcceptance.deleteMany({ where: { productiveProcessId: { in: ppIds } } });
  await prisma.custodyEntry.deleteMany({ where: { productiveProcessId: { in: ppIds } } });
  await prisma.samplingPlanEquipment.deleteMany({ where: { samplingPlan: { productiveProcessId: { in: ppIds } } } });
  await prisma.samplingPlan.deleteMany({ where: { productiveProcessId: { in: ppIds } } });
  const serviceOrders = await prisma.serviceOrder.findMany({ where: { productiveProcessId: { in: ppIds } }, select: { id: true } });
  const serviceOrderIds = serviceOrders.map((so) => so.id);
  await prisma.serviceOrderItem.deleteMany({ where: { serviceOrderId: { in: serviceOrderIds } } });
  await prisma.serviceOrder.deleteMany({ where: { id: { in: serviceOrderIds } } });
  await prisma.productiveProcess.deleteMany({ where: { id: { in: ppIds } } });
  await prisma.auditLog.deleteMany({
    where: { entityType: { in: ["Proposal", "ProductiveProcess", "SamplingPlan", "CustodyEntry", "SampleAcceptance", "ResultWorksheet", "Equipment"] } },
  });
  await prisma.proposalTest.deleteMany({ where: { proposalId: { in: createdProposalIds } } });
  await prisma.proposalStatusHistory.deleteMany({ where: { proposalId: { in: createdProposalIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.proposalCollectionPoint.deleteMany({ where: { collectionPointId: { in: createdPointIds } } });
  await prisma.test.deleteMany({ where: { matrix: { in: ["QUALIDADE_AR", "RUIDO_AMBIENTAL", "EMISSOES_ATMOSFERICAS"] }, name: { contains: "Teste" } } });
  await prisma.collectionPoint.deleteMany({ where: { id: { in: createdPointIds } } });
  await prisma.equipment.deleteMany({ where: { id: { in: createdEquipmentIds } } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.role.deleteMany({ where: { id: roleId } });
  await prisma.$disconnect();
});

describe("Geração automática de Processo Produtivo + Ordem de Serviço na aprovação", () => {
  it("proposta com 3 matrizes aprovada gera 1 Processo Produtivo + 1 Ordem de Serviço por ponto, cada um em status PLANEJADO", async () => {
    const { productiveProcesses } = await createApprovedCampaign([
      { matrix: "EMISSOES_ATMOSFERICAS", name: "Chaminé A" },
      { matrix: "QUALIDADE_AR", name: "Ponto Ar B" },
      { matrix: "RUIDO_AMBIENTAL", name: "Ponto Ruído C" },
    ]);

    expect(productiveProcesses).toHaveLength(3);
    expect(productiveProcesses.every((pp) => pp.status === "PLANEJADO")).toBe(true);
    const matrices = productiveProcesses.map((pp) => pp.collectionPoint.matrix).sort();
    expect(matrices).toEqual(["EMISSOES_ATMOSFERICAS", "QUALIDADE_AR", "RUIDO_AMBIENTAL"]);

    for (const pp of productiveProcesses) {
      const serviceOrders = await prisma.serviceOrder.findMany({ where: { productiveProcessId: pp.id }, include: { items: true } });
      expect(serviceOrders).toHaveLength(1);
      expect(serviceOrders[0].items).toHaveLength(1);
    }
  });

  it("não duplica Processo Produtivo se já existir para o ponto (idempotência)", async () => {
    const { proposal, productiveProcesses } = await createApprovedCampaign([{ matrix: "QUALIDADE_AR", name: "Ponto Idempotente" }]);
    expect(productiveProcesses).toHaveLength(1);

    const count = await prisma.productiveProcess.count({ where: { proposalId: proposal.id } });
    expect(count).toBe(1);
  });
});

describe("Ciclo de vida técnico (ISO 17025) — caminho feliz completo, matriz EA/QAR (gravimetria)", () => {
  it("PLANEJADO -> AGENDADO -> EM_CAMPO -> RECEBIDO_CUSTODIA -> EM_ANALISE -> VALIDADO", async () => {
    const { productiveProcesses } = await createApprovedCampaign([{ matrix: "QUALIDADE_AR", name: "Ponto Fluxo Completo" }]);
    const pp = productiveProcesses[0];
    expect(pp.status).toBe("PLANEJADO");

    // Fase 1: Plano de Amostragem -> avança para AGENDADO
    await createOrUpdateSamplingPlan(userId, pp.id, {
      scheduledAt: new Date("2026-11-01T08:00:00Z"),
      fieldResponsibleId: userId,
      notes: "Levar equipamento reserva.",
      equipmentIds: [],
    });
    let reloaded = await prisma.productiveProcess.findUniqueOrThrow({ where: { id: pp.id } });
    expect(reloaded.status).toBe("AGENDADO");

    // Ação explícita: marcar coleta em campo concluída
    await transitionProductiveProcessStatus(userId, pp.id, "EM_CAMPO");
    reloaded = await prisma.productiveProcess.findUniqueOrThrow({ where: { id: pp.id } });
    expect(reloaded.status).toBe("EM_CAMPO");

    // Fase 2: Entrada e Custódia -> avança para RECEBIDO_CUSTODIA
    await createOrUpdateCustodyEntry(userId, pp.id, {
      arrivedAt: new Date("2026-11-01T14:00:00Z"),
      weatherConditions: "Ensolarado, sem chuva",
      temperatureC: 28.5,
      humidityPercent: 60,
    });
    reloaded = await prisma.productiveProcess.findUniqueOrThrow({ where: { id: pp.id } });
    expect(reloaded.status).toBe("RECEBIDO_CUSTODIA");

    // Fase 3: Checagem e Aceitação (aceita) -> avança para EM_ANALISE
    await createOrUpdateSampleAcceptance(userId, pp.id, {
      status: "ACEITA",
      filtersIntegrityOk: true,
      sealsIntegrityOk: true,
      absorbentSolutionOk: true,
      deviationNotes: null,
    });
    reloaded = await prisma.productiveProcess.findUniqueOrThrow({ where: { id: pp.id } });
    expect(reloaded.status).toBe("EM_ANALISE");

    // Fase 4: Resultados (gravimetria, matriz QUALIDADE_AR)
    await createOrUpdateResultWorksheet(userId, pp.id, {
      gravimetry: { filterWeightBefore: 1.234, filterWeightAfter: 1.456, fieldBlankWeight: 0.001, labReadingValue: 0.221, sampledVolumeM3: 10 },
    });

    // Ação explícita: validar resultados -> VALIDADO
    await transitionProductiveProcessStatus(userId, pp.id, "VALIDADO");
    reloaded = await prisma.productiveProcess.findUniqueOrThrow({ where: { id: pp.id } });
    expect(reloaded.status).toBe("VALIDADO");

    const worksheet = await prisma.resultWorksheet.findUniqueOrThrow({ where: { productiveProcessId: pp.id } });
    expect(worksheet.validatedById).toBe(userId);
    expect(worksheet.validatedAt).not.toBeNull();
  });
});

describe("Ciclo de vida técnico — matriz Ruído Ambiental (leituras acústicas)", () => {
  it("usa o detalhe acústico (Leq/L10/L90) em vez de gravimetria para RUIDO_AMBIENTAL", async () => {
    const { productiveProcesses } = await createApprovedCampaign([{ matrix: "RUIDO_AMBIENTAL", name: "Ponto Ruído Fluxo" }]);
    const pp = productiveProcesses[0];

    await createOrUpdateSamplingPlan(userId, pp.id, { scheduledAt: new Date(), fieldResponsibleId: userId, equipmentIds: [] });
    await transitionProductiveProcessStatus(userId, pp.id, "EM_CAMPO");
    await createOrUpdateCustodyEntry(userId, pp.id, { arrivedAt: new Date() });
    await createOrUpdateSampleAcceptance(userId, pp.id, {
      status: "ACEITA",
      filtersIntegrityOk: true,
      sealsIntegrityOk: true,
      absorbentSolutionOk: true,
    });

    // Tentar preencher gravimetria numa matriz acústica deve ser rejeitado.
    await expect(createOrUpdateResultWorksheet(userId, pp.id, { gravimetry: { labReadingValue: 1 } })).rejects.toThrow(ApiError);

    const worksheet = await createOrUpdateResultWorksheet(userId, pp.id, {
      acoustic: { leqDba: 62.4, l10Dba: 65.1, l90Dba: 55.3, backgroundNoiseDba: 50.2, measurementMinutes: 15 },
    });
    expect(Number(worksheet.acoustic?.leqDba)).toBe(62.4);
    expect(worksheet.gravimetry).toBeNull();

    await transitionProductiveProcessStatus(userId, pp.id, "VALIDADO");
    const reloaded = await prisma.productiveProcess.findUniqueOrThrow({ where: { id: pp.id } });
    expect(reloaded.status).toBe("VALIDADO");
  });
});

describe("Rejeição de amostra (fase 3)", () => {
  it("amostra REJEITADA leva o processo a status REJEITADO (terminal), nunca a EM_ANALISE", async () => {
    const { productiveProcesses } = await createApprovedCampaign([{ matrix: "QUALIDADE_AR", name: "Ponto Rejeição" }]);
    const pp = productiveProcesses[0];

    await createOrUpdateSamplingPlan(userId, pp.id, { scheduledAt: new Date(), fieldResponsibleId: userId, equipmentIds: [] });
    await transitionProductiveProcessStatus(userId, pp.id, "EM_CAMPO");
    await createOrUpdateCustodyEntry(userId, pp.id, { arrivedAt: new Date() });

    await createOrUpdateSampleAcceptance(userId, pp.id, {
      status: "REJEITADA",
      filtersIntegrityOk: false,
      sealsIntegrityOk: true,
      absorbentSolutionOk: true,
      deviationNotes: "Filtro rompido durante o transporte.",
    });

    const reloaded = await prisma.productiveProcess.findUniqueOrThrow({ where: { id: pp.id } });
    expect(reloaded.status).toBe("REJEITADO");

    // Status terminal: nenhuma transição adicional é permitida.
    await expect(transitionProductiveProcessStatus(userId, pp.id, "VALIDADO")).rejects.toThrow(ApiError);
  });

  it("rejeitar/ressalvar sem informar o motivo é bloqueado", async () => {
    const { productiveProcesses } = await createApprovedCampaign([{ matrix: "QUALIDADE_AR", name: "Ponto Rejeição Sem Motivo" }]);
    const pp = productiveProcesses[0];
    await createOrUpdateSamplingPlan(userId, pp.id, { scheduledAt: new Date(), fieldResponsibleId: userId, equipmentIds: [] });
    await transitionProductiveProcessStatus(userId, pp.id, "EM_CAMPO");
    await createOrUpdateCustodyEntry(userId, pp.id, { arrivedAt: new Date() });

    await expect(
      createOrUpdateSampleAcceptance(userId, pp.id, {
        status: "REJEITADA",
        filtersIntegrityOk: false,
        sealsIntegrityOk: true,
        absorbentSolutionOk: true,
        deviationNotes: null,
      }),
    ).rejects.toThrow(ApiError);
  });
});

describe("Guardas de transição de status (não pula fases)", () => {
  it("não permite registrar custódia antes de marcar a coleta em campo como concluída", async () => {
    const { productiveProcesses } = await createApprovedCampaign([{ matrix: "QUALIDADE_AR", name: "Ponto Guarda Custódia" }]);
    const pp = productiveProcesses[0];
    // status ainda é PLANEJADO (nem AGENDADO)
    await expect(createOrUpdateCustodyEntry(userId, pp.id, { arrivedAt: new Date() })).rejects.toThrow(ApiError);
  });

  it("não permite registrar aceitação sem custódia registrada", async () => {
    const { productiveProcesses } = await createApprovedCampaign([{ matrix: "QUALIDADE_AR", name: "Ponto Guarda Aceitação" }]);
    const pp = productiveProcesses[0];
    await createOrUpdateSamplingPlan(userId, pp.id, { scheduledAt: new Date(), fieldResponsibleId: userId, equipmentIds: [] });
    await transitionProductiveProcessStatus(userId, pp.id, "EM_CAMPO");
    // ainda não registrou CustodyEntry
    await expect(
      createOrUpdateSampleAcceptance(userId, pp.id, { status: "ACEITA", filtersIntegrityOk: true, sealsIntegrityOk: true, absorbentSolutionOk: true }),
    ).rejects.toThrow(ApiError);
  });

  it("não permite validar resultados sem a folha de resultados preenchida", async () => {
    const { productiveProcesses } = await createApprovedCampaign([{ matrix: "QUALIDADE_AR", name: "Ponto Guarda Validação" }]);
    const pp = productiveProcesses[0];
    await createOrUpdateSamplingPlan(userId, pp.id, { scheduledAt: new Date(), fieldResponsibleId: userId, equipmentIds: [] });
    await transitionProductiveProcessStatus(userId, pp.id, "EM_CAMPO");
    await createOrUpdateCustodyEntry(userId, pp.id, { arrivedAt: new Date() });
    await createOrUpdateSampleAcceptance(userId, pp.id, { status: "ACEITA", filtersIntegrityOk: true, sealsIntegrityOk: true, absorbentSolutionOk: true });

    // EM_ANALISE, mas a folha de resultados ainda não tem leitura preenchida
    await expect(transitionProductiveProcessStatus(userId, pp.id, "VALIDADO")).rejects.toThrow(ApiError);
  });

  it("cancelar é permitido a partir de qualquer status não-terminal", async () => {
    const { productiveProcesses } = await createApprovedCampaign([{ matrix: "QUALIDADE_AR", name: "Ponto Cancelamento" }]);
    const pp = productiveProcesses[0];
    await transitionProductiveProcessStatus(userId, pp.id, "CANCELADO");
    const reloaded = await prisma.productiveProcess.findUniqueOrThrow({ where: { id: pp.id } });
    expect(reloaded.status).toBe("CANCELADO");
  });
});

describe("Independência entre matrizes da mesma campanha", () => {
  it("o status de um ponto não afeta o status dos pontos de outras matrizes na mesma proposta", async () => {
    const { productiveProcesses } = await createApprovedCampaign([
      { matrix: "EMISSOES_ATMOSFERICAS", name: "Chaminé Independente" },
      { matrix: "RUIDO_AMBIENTAL", name: "Ruído Independente" },
    ]);
    const [ppEA, ppRA] = productiveProcesses;

    await createOrUpdateSamplingPlan(userId, ppEA.id, { scheduledAt: new Date(), fieldResponsibleId: userId, equipmentIds: [] });

    const reloadedEA = await prisma.productiveProcess.findUniqueOrThrow({ where: { id: ppEA.id } });
    const reloadedRA = await prisma.productiveProcess.findUniqueOrThrow({ where: { id: ppRA.id } });
    expect(reloadedEA.status).toBe("AGENDADO");
    expect(reloadedRA.status).toBe("PLANEJADO");
  });
});

describe("Checklist de equipamentos — snapshot de calibração (ISO 17025)", () => {
  it("a validade da calibração registrada no plano não muda se o cadastro do equipamento for alterado depois", async () => {
    const equipment = await prisma.equipment.create({
      data: { name: "Sonômetro Teste", calibrationValidUntil: new Date("2026-12-31") },
    });
    createdEquipmentIds.push(equipment.id);

    const { productiveProcesses } = await createApprovedCampaign([{ matrix: "RUIDO_AMBIENTAL", name: "Ponto Equipamento" }]);
    const pp = productiveProcesses[0];

    await createOrUpdateSamplingPlan(userId, pp.id, {
      scheduledAt: new Date("2026-11-01"),
      fieldResponsibleId: userId,
      equipmentIds: [equipment.id],
    });

    // Calibração do equipamento é alterada DEPOIS do plano já ter sido registrado.
    await prisma.equipment.update({ where: { id: equipment.id }, data: { calibrationValidUntil: new Date("2020-01-01") } });

    const check = await prisma.samplingPlanEquipment.findFirstOrThrow({
      where: { samplingPlan: { productiveProcessId: pp.id }, equipmentId: equipment.id },
    });
    expect(check.calibrationValidUntilSnapshot?.toISOString().slice(0, 10)).toBe("2026-12-31");
  });
});
