import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createProposal, changeProposalStatus } from "@/lib/services/proposal-service";
import { createProductiveProcess, createServiceOrder } from "@/lib/services/productive-process-service";
import { ApiError } from "@/lib/api-helpers";

// Testes de integração contra o banco de desenvolvimento real (Postgres),
// cobrindo os 8 cenários obrigatórios do fluxo Proposta Aprovada -> Processo
// Produtivo -> Ordem de Serviço. Usa registros com sufixo aleatório para não
// colidir com dados reais/seed, e remove tudo o que cria ao final.

let roleId: string;
let userId: string;
let clientId: string;
let testId: string;
const createdPointIds: string[] = [];
const createdProposalIds: string[] = [];

async function createApprovedProposalWithPoints(pointIds: string[], quantityPerPoint = 2) {
  const proposal = await createProposal(userId, {
    clientId,
    matrices: ["QUALIDADE_AR"],
    contactIds: [],
    exhibitUnitValue: true,
    useAdditionalCosts: true,
    exhibitTravelValue: true,
  });
  createdProposalIds.push(proposal.id);

  await prisma.proposalCollectionPoint.createMany({
    data: pointIds.map((collectionPointId) => ({ proposalId: proposal.id, collectionPointId })),
  });
  await prisma.proposalTest.createMany({
    data: pointIds.map((collectionPointId) => ({
      proposalId: proposal.id,
      testId,
      collectionPointId,
      nameSnapshot: "Ensaio Teste",
      methodSnapshot: "Método Teste",
      unitSnapshot: "mg/Nm³",
      codeSnapshot: "COD-TESTE",
      valueSnapshot: 100,
      quantity: quantityPerPoint,
    })),
  });

  await changeProposalStatus(userId, proposal.id, "ENVIADA");
  await changeProposalStatus(userId, proposal.id, "APROVADA");

  return proposal;
}

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);

  const role = await prisma.role.create({ data: { name: `TEST_ROLE_PP_${suffix}` } });
  roleId = role.id;

  const user = await prisma.user.create({
    data: { name: "Usuário PP Teste", email: `teste-pp-${suffix}@example.com`, passwordHash: "x", roleId },
  });
  userId = user.id;

  const client = await prisma.client.create({
    data: { cnpj: suffix.padEnd(14, "1").slice(0, 14), corporateName: `Cliente PP Teste ${suffix}` },
  });
  clientId = client.id;

  const test = await prisma.test.create({
    data: {
      name: `Ensaio PP Teste ${suffix}`,
      method: "Método X",
      unit: "mg/Nm³",
      parameterCode: `COD-PP-${suffix}`,
      value: 100,
      matrix: "QUALIDADE_AR",
    },
  });
  testId = test.id;
});

afterAll(async () => {
  const pps = await prisma.productiveProcess.findMany({ where: { proposalId: { in: createdProposalIds } }, select: { id: true } });
  const ppIds = pps.map((p) => p.id);
  const serviceOrders = await prisma.serviceOrder.findMany({ where: { productiveProcessId: { in: ppIds } }, select: { id: true } });
  const serviceOrderIds = serviceOrders.map((so) => so.id);

  await prisma.serviceOrderItem.deleteMany({ where: { serviceOrderId: { in: serviceOrderIds } } });
  await prisma.serviceOrder.deleteMany({ where: { id: { in: serviceOrderIds } } });
  await prisma.productiveProcess.deleteMany({ where: { id: { in: ppIds } } });
  await prisma.auditLog.deleteMany({
    where: {
      entityType: { in: ["Proposal", "ProductiveProcess", "ServiceOrder"] },
      entityId: { in: [...createdProposalIds, ...ppIds, ...serviceOrderIds] },
    },
  });
  await prisma.proposalStatusHistory.deleteMany({ where: { proposalId: { in: createdProposalIds } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.collectionPoint.deleteMany({ where: { id: { in: createdPointIds } } });
  await prisma.test.deleteMany({ where: { id: testId } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.role.deleteMany({ where: { id: roleId } });
  await prisma.$disconnect();
});

describe("createProductiveProcess", () => {
  it("cenário 1: proposta aprovada com 1 ponto de coleta gera 1 Processo Produtivo", async () => {
    const point = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto Único" } });
    createdPointIds.push(point.id);

    const proposal = await createApprovedProposalWithPoints([point.id]);
    const pp = await createProductiveProcess(userId, { proposalId: proposal.id, collectionPointId: point.id });

    expect(pp.code).toMatch(/^PP \d{3}\/\d{4}$/);
    expect(pp.proposalId).toBe(proposal.id);
    expect(pp.collectionPointId).toBe(point.id);
  });

  it("cenário 2: proposta aprovada com 3 pontos permite 1 Processo Produtivo independente por ponto", async () => {
    const pointA = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto A" } });
    const pointB = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto B" } });
    const pointC = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto C" } });
    createdPointIds.push(pointA.id, pointB.id, pointC.id);

    const proposal = await createApprovedProposalWithPoints([pointA.id, pointB.id, pointC.id]);

    const ppA = await createProductiveProcess(userId, { proposalId: proposal.id, collectionPointId: pointA.id });
    const ppB = await createProductiveProcess(userId, { proposalId: proposal.id, collectionPointId: pointB.id });

    expect(ppA.id).not.toBe(ppB.id);
    expect(ppA.code).not.toBe(ppB.code);
    expect(ppA.collectionPointId).toBe(pointA.id);
    expect(ppB.collectionPointId).toBe(pointB.id);

    const allForProposal = await prisma.productiveProcess.findMany({ where: { proposalId: proposal.id } });
    expect(allForProposal.length).toBe(2);
    // Ponto C continua disponível para gerar um terceiro Processo Produtivo quando o usuário decidir.
    const ppC = await createProductiveProcess(userId, { proposalId: proposal.id, collectionPointId: pointC.id });
    expect(ppC.collectionPointId).toBe(pointC.id);
  });

  it("cenário 5: bloqueia a geração de Processo Produtivo para proposta não aprovada", async () => {
    const point = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto Não Aprovada" } });
    createdPointIds.push(point.id);

    const proposal = await createProposal(userId, {
      clientId,
      matrices: ["QUALIDADE_AR"],
      contactIds: [],
      exhibitUnitValue: true,
      useAdditionalCosts: true,
      exhibitTravelValue: true,
    });
    createdProposalIds.push(proposal.id);
    await prisma.proposalCollectionPoint.create({ data: { proposalId: proposal.id, collectionPointId: point.id } });

    await expect(createProductiveProcess(userId, { proposalId: proposal.id, collectionPointId: point.id })).rejects.toThrow(ApiError);
  });

  it("bloqueia a criação de Processo Produtivo para ponto que não pertence à proposta", async () => {
    const pointInProposal = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto Pertence" } });
    const pointOutside = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto Fora" } });
    createdPointIds.push(pointInProposal.id, pointOutside.id);

    const proposal = await createApprovedProposalWithPoints([pointInProposal.id]);

    await expect(createProductiveProcess(userId, { proposalId: proposal.id, collectionPointId: pointOutside.id })).rejects.toThrow(ApiError);
  });
});

describe("createServiceOrder", () => {
  it("cenário 3: gera OS com número correto e parâmetros selecionados", async () => {
    const point = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto OS 1" } });
    createdPointIds.push(point.id);

    const proposal = await createApprovedProposalWithPoints([point.id]);
    const pp = await createProductiveProcess(userId, { proposalId: proposal.id, collectionPointId: point.id });

    const proposalTest = await prisma.proposalTest.findFirstOrThrow({ where: { proposalId: proposal.id, collectionPointId: point.id } });

    const os = await createServiceOrder(userId, pp.id, [{ proposalTestId: proposalTest.id, quantity: 2 }]);

    expect(os.code).toBe(`${pp.code.replace("PP ", "OS ")}_1`);
    expect(os.sequenceInProcess).toBe(1);

    const items = await prisma.serviceOrderItem.findMany({ where: { serviceOrderId: os.id } });
    expect(items).toHaveLength(1);
    expect(items[0].proposalTestId).toBe(proposalTest.id);
    expect(items[0].quantity).toBe(2);
  });

  it("cenário 4: gera segunda OS para o mesmo PP sem sobrescrever a primeira", async () => {
    const point = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto OS 2" } });
    createdPointIds.push(point.id);

    const proposal = await createApprovedProposalWithPoints([point.id]);
    const pp = await createProductiveProcess(userId, { proposalId: proposal.id, collectionPointId: point.id });
    const proposalTest = await prisma.proposalTest.findFirstOrThrow({ where: { proposalId: proposal.id, collectionPointId: point.id } });

    const firstOs = await createServiceOrder(userId, pp.id, [{ proposalTestId: proposalTest.id, quantity: 1 }]);
    const secondOs = await createServiceOrder(userId, pp.id, [{ proposalTestId: proposalTest.id, quantity: 1 }]);

    expect(firstOs.id).not.toBe(secondOs.id);
    expect(firstOs.code).not.toBe(secondOs.code);
    expect(secondOs.sequenceInProcess).toBe(2);

    const firstStillExists = await prisma.serviceOrder.findUnique({ where: { id: firstOs.id } });
    expect(firstStillExists).not.toBeNull();

    const allOrders = await prisma.serviceOrder.findMany({ where: { productiveProcessId: pp.id } });
    expect(allOrders).toHaveLength(2);
    expect(new Set(allOrders.map((o) => o.code)).size).toBe(2);
  });

  it("cenário 6: bloqueia a criação de OS sem Processo Produtivo existente", async () => {
    await expect(createServiceOrder(userId, "pp-inexistente", [{ proposalTestId: "qualquer", quantity: 1 }])).rejects.toThrow(ApiError);
  });

  it("cenário 7: bloqueia a criação de OS sem parâmetros selecionados", async () => {
    const point = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto OS Vazia" } });
    createdPointIds.push(point.id);

    const proposal = await createApprovedProposalWithPoints([point.id]);
    const pp = await createProductiveProcess(userId, { proposalId: proposal.id, collectionPointId: point.id });

    await expect(createServiceOrder(userId, pp.id, [])).rejects.toThrow(ApiError);
  });

  it("bloqueia a seleção de parâmetros que não pertencem ao ponto/proposta do Processo Produtivo", async () => {
    const pointA = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto OS A" } });
    const pointB = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto OS B" } });
    createdPointIds.push(pointA.id, pointB.id);

    const proposal = await createApprovedProposalWithPoints([pointA.id, pointB.id]);
    const ppA = await createProductiveProcess(userId, { proposalId: proposal.id, collectionPointId: pointA.id });
    const testOfPointB = await prisma.proposalTest.findFirstOrThrow({ where: { proposalId: proposal.id, collectionPointId: pointB.id } });

    await expect(createServiceOrder(userId, ppA.id, [{ proposalTestId: testOfPointB.id, quantity: 1 }])).rejects.toThrow(ApiError);
  });

  it("cenário 8: rastreabilidade OS -> PP -> Ponto de Coleta -> Proposta -> Cliente", async () => {
    const point = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto Rastreio" } });
    createdPointIds.push(point.id);

    const proposal = await createApprovedProposalWithPoints([point.id]);
    const pp = await createProductiveProcess(userId, { proposalId: proposal.id, collectionPointId: point.id });
    const proposalTest = await prisma.proposalTest.findFirstOrThrow({ where: { proposalId: proposal.id, collectionPointId: point.id } });
    const os = await createServiceOrder(userId, pp.id, [{ proposalTestId: proposalTest.id, quantity: 1 }]);

    const full = await prisma.serviceOrder.findUniqueOrThrow({
      where: { id: os.id },
      include: {
        productiveProcess: {
          include: {
            collectionPoint: true,
            proposal: { include: { client: true } },
          },
        },
      },
    });

    expect(full.productiveProcess.id).toBe(pp.id);
    expect(full.productiveProcess.collectionPoint.id).toBe(point.id);
    expect(full.productiveProcess.proposal.id).toBe(proposal.id);
    expect(full.productiveProcess.proposal.client.id).toBe(clientId);
  });
});
