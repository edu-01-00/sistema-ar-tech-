import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  createProposal,
  createProposalRevision,
  changeProposalStatus,
  recalculateProposalTotals,
  proposalDetailInclude,
} from "@/lib/services/proposal-service";
import { ApiError } from "@/lib/api-helpers";
import { buildProposalHtml } from "@/lib/pdf/proposal-template";
import { formatCurrency } from "@/lib/format";

// Testes de integração contra o banco de desenvolvimento real (Postgres),
// cobrindo as regras mais críticas de propostas: geração de código único,
// reinício da numeração por ano, controle de revisão e transições de status.
// Usa anos "de teste" (2098/2099) exclusivos para não colidir com dados
// reais/seed, e remove tudo o que cria ao final.

let roleId: string;
let userId: string;
let clientId: string;
const createdProposalIds: string[] = [];

const TEST_YEARS = [2098, 2099];

beforeAll(async () => {
  // Garante idempotência mesmo se uma execução anterior tiver sido
  // interrompida antes do afterAll rodar.
  await prisma.proposalSequence.deleteMany({ where: { year: { in: TEST_YEARS } } });

  const suffix = randomUUID().slice(0, 8);

  const role = await prisma.role.create({ data: { name: `TEST_ROLE_${suffix}` } });
  roleId = role.id;

  const user = await prisma.user.create({
    data: {
      name: "Usuário de Teste",
      email: `teste-${suffix}@example.com`,
      passwordHash: "x",
      roleId,
    },
  });
  userId = user.id;

  const client = await prisma.client.create({
    data: {
      cnpj: suffix.padEnd(14, "0").slice(0, 14),
      corporateName: `Cliente de Teste ${suffix}`,
    },
  });
  clientId = client.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityType: "Proposal", entityId: { in: createdProposalIds } } });
  await prisma.proposalStatusHistory.deleteMany({ where: { proposalId: { in: createdProposalIds } } });
  await prisma.proposalSequence.deleteMany({ where: { year: { in: TEST_YEARS } } });
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.role.deleteMany({ where: { id: roleId } });
  await prisma.$disconnect();
});

describe("createProposal - geração de código e reinício anual", () => {
  it("gera códigos sequenciais únicos dentro do mesmo ano", async () => {
    vi.setSystemTime(new Date(2098, 0, 15));

    const first = await createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [], exhibitUnitValue: true, useAdditionalCosts: true, exhibitTravelValue: true });
    const second = await createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [], exhibitUnitValue: true, useAdditionalCosts: true, exhibitTravelValue: true });
    createdProposalIds.push(first.id, second.id);

    expect(first.year).toBe(2098);
    expect(second.year).toBe(2098);
    expect(second.sequenceNumber).toBe(first.sequenceNumber + 1);
    expect(first.code).not.toBe(second.code);
    expect(first.code).toMatch(/^PR-\d{3}\/2098-R00$/);

    vi.useRealTimers();
  });

  it("reinicia a numeração sequencial em um novo ano", async () => {
    vi.setSystemTime(new Date(2099, 0, 1));
    const proposal = await createProposal(userId, { clientId, matrices: ["RUIDO_AMBIENTAL"], contactIds: [], exhibitUnitValue: true, useAdditionalCosts: true, exhibitTravelValue: true });
    createdProposalIds.push(proposal.id);

    expect(proposal.year).toBe(2099);
    expect(proposal.sequenceNumber).toBe(1);
    expect(proposal.code).toBe("PR-001/2099-R00");

    vi.useRealTimers();
  });

  it("nunca gera dois códigos duplicados mesmo com criação concorrente", async () => {
    vi.setSystemTime(new Date(2098, 5, 1));

    const results = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [], exhibitUnitValue: true, useAdditionalCosts: true, exhibitTravelValue: true }),
      ),
    );
    createdProposalIds.push(...results.map((r) => r.id));

    const codes = results.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);

    vi.useRealTimers();
  });
});

describe("createProposalRevision - controle de revisão", () => {
  it("cria uma revisão mantendo o histórico da anterior", async () => {
    vi.setSystemTime(new Date(2098, 2, 1));
    const original = await createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [], exhibitUnitValue: true, useAdditionalCosts: true, exhibitTravelValue: true });
    createdProposalIds.push(original.id);

    const revision = await createProposalRevision(userId, original.id);
    createdProposalIds.push(revision.id);

    expect(revision.revision).toBe(1);
    expect(revision.rootId).toBe(original.rootId);
    expect(revision.code).toBe(original.code.replace("-R00", "-R01"));

    const supersededOriginal = await prisma.proposal.findUniqueOrThrow({ where: { id: original.id } });
    expect(supersededOriginal.supersededAt).not.toBeNull();

    vi.useRealTimers();
  });

  it("não permite revisar uma proposta que já foi substituída", async () => {
    vi.setSystemTime(new Date(2098, 3, 1));
    const original = await createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [], exhibitUnitValue: true, useAdditionalCosts: true, exhibitTravelValue: true });
    createdProposalIds.push(original.id);
    const revision = await createProposalRevision(userId, original.id);
    createdProposalIds.push(revision.id);

    await expect(createProposalRevision(userId, original.id)).rejects.toThrow(ApiError);

    vi.useRealTimers();
  });
});

describe("changeProposalStatus - transições de status", () => {
  it("permite o fluxo em elaboração -> enviada -> aprovada", async () => {
    vi.setSystemTime(new Date(2098, 4, 1));
    const proposal = await createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [], exhibitUnitValue: true, useAdditionalCosts: true, exhibitTravelValue: true });
    createdProposalIds.push(proposal.id);

    await changeProposalStatus(userId, proposal.id, "ENVIADA");
    const approved = await changeProposalStatus(userId, proposal.id, "APROVADA");
    expect(approved.status).toBe("APROVADA");

    const history = await prisma.proposalStatusHistory.findMany({ where: { proposalId: proposal.id } });
    expect(history.map((h) => h.status)).toEqual(["ENVIADA", "APROVADA"]);

    vi.useRealTimers();
  });

  it("rejeita pular etapas do fluxo (em elaboração -> aprovada)", async () => {
    vi.setSystemTime(new Date(2098, 4, 2));
    const proposal = await createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [], exhibitUnitValue: true, useAdditionalCosts: true, exhibitTravelValue: true });
    createdProposalIds.push(proposal.id);

    await expect(changeProposalStatus(userId, proposal.id, "APROVADA")).rejects.toThrow(ApiError);

    vi.useRealTimers();
  });
});

describe("recalculateProposalTotals - desconto e custo adicional (persistência real)", () => {
  it("custo adicional sempre compõe o total e o desconto é calculado sobre o valor-base completo", async () => {
    vi.setSystemTime(new Date(2098, 6, 1));
    const proposal = await createProposal(userId, {
      clientId,
      matrices: ["QUALIDADE_AR"],
      contactIds: [],
      exhibitUnitValue: true,
      useAdditionalCosts: true,
      exhibitTravelValue: true,
    });
    createdProposalIds.push(proposal.id);

    // Custo adicional de R$ 100,00 (sem ensaios/deslocamento neste cenário) + desconto de 3%.
    await prisma.proposalCost.create({ data: { proposalId: proposal.id, description: "ART", value: 100, type: "ART" } });
    await prisma.proposal.update({ where: { id: proposal.id }, data: { discountPercent: 3 } });

    const totals = await prisma.$transaction((tx) => recalculateProposalTotals(tx, proposal.id));
    expect(totals.otherCostsTotal).toBe(100);
    expect(totals.baseValue).toBe(100);
    expect(totals.discountValue).toBe(3);
    expect(totals.totalValue).toBe(97);

    const persisted = await prisma.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    expect(Number(persisted.otherCostsTotal)).toBe(100);
    expect(Number(persisted.discountValue)).toBe(3);
    expect(Number(persisted.totalValue)).toBe(97);

    vi.useRealTimers();
  });

  it("a revisão carrega o desconto e o valor calculado da proposta original (não recalcula do zero)", async () => {
    vi.setSystemTime(new Date(2098, 6, 2));
    const proposal = await createProposal(userId, {
      clientId,
      matrices: ["QUALIDADE_AR"],
      contactIds: [],
      exhibitUnitValue: true,
      useAdditionalCosts: true,
      exhibitTravelValue: true,
    });
    createdProposalIds.push(proposal.id);
    await prisma.proposal.update({ where: { id: proposal.id }, data: { discountPercent: 5, discountValue: 10, totalValue: 190 } });

    const revision = await createProposalRevision(userId, proposal.id);
    createdProposalIds.push(revision.id);

    expect(Number(revision.discountPercent)).toBe(5);
    expect(Number(revision.discountValue)).toBe(10);
    expect(Number(revision.totalValue)).toBe(190);

    vi.useRealTimers();
  });
});

describe("Rateio proporcional do custo adicional entre os ensaios (PDF) — persistência real", () => {
  async function setupProposalWithThreeTests(useAdditionalCosts: boolean) {
    const proposal = await createProposal(userId, {
      clientId,
      matrices: ["QUALIDADE_AR"],
      contactIds: [],
      exhibitUnitValue: true,
      useAdditionalCosts,
      exhibitTravelValue: true,
    });
    createdProposalIds.push(proposal.id);

    const point = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto Único" } });
    await prisma.proposalCollectionPoint.create({ data: { proposalId: proposal.id, collectionPointId: point.id } });

    const suffix = randomUUID().slice(0, 6);
    const testA = await prisma.test.create({ data: { name: "Ensaio A", method: "M-A", unit: "mg/m³", parameterCode: `TA-${suffix}`, value: 1000, matrix: "QUALIDADE_AR" } });
    const testB = await prisma.test.create({ data: { name: "Ensaio B", method: "M-B", unit: "mg/m³", parameterCode: `TB-${suffix}`, value: 2000, matrix: "QUALIDADE_AR" } });
    const testC = await prisma.test.create({ data: { name: "Ensaio C", method: "M-C", unit: "mg/m³", parameterCode: `TC-${suffix}`, value: 3000, matrix: "QUALIDADE_AR" } });

    await prisma.proposalTest.createMany({
      data: [
        { proposalId: proposal.id, testId: testA.id, collectionPointId: point.id, nameSnapshot: "Ensaio A", methodSnapshot: "M-A", unitSnapshot: "mg/m³", codeSnapshot: testA.parameterCode, valueSnapshot: 1000, quantity: 1 },
        { proposalId: proposal.id, testId: testB.id, collectionPointId: point.id, nameSnapshot: "Ensaio B", methodSnapshot: "M-B", unitSnapshot: "mg/m³", codeSnapshot: testB.parameterCode, valueSnapshot: 2000, quantity: 1 },
        { proposalId: proposal.id, testId: testC.id, collectionPointId: point.id, nameSnapshot: "Ensaio C", methodSnapshot: "M-C", unitSnapshot: "mg/m³", codeSnapshot: testC.parameterCode, valueSnapshot: 3000, quantity: 1 },
      ],
    });

    await prisma.proposalCost.create({ data: { proposalId: proposal.id, description: "Custo adicional de teste", value: 600, type: "OUTRO" } });
    await prisma.$transaction((tx) => recalculateProposalTotals(tx, proposal.id));

    const full = await prisma.proposal.findUniqueOrThrow({ where: { id: proposal.id }, include: proposalDetailInclude });

    return {
      proposal,
      point,
      testIds: [testA.id, testB.id, testC.id],
      full,
      cleanup: async () => {
        await prisma.proposalTest.deleteMany({ where: { proposalId: proposal.id } });
        await prisma.proposalCost.deleteMany({ where: { proposalId: proposal.id } });
        await prisma.test.deleteMany({ where: { id: { in: [testA.id, testB.id, testC.id] } } });
        await prisma.proposalCollectionPoint.deleteMany({ where: { proposalId: proposal.id } });
        await prisma.collectionPoint.deleteMany({ where: { id: point.id } });
      },
    };
  }

  it("'Demonstrar custo adicional?' = Não: cada ensaio exibe seu valor original + rateio proporcional (exemplo do requisito: 1000/2000/3000 + 600 -> 1100/2200/3300)", async () => {
    vi.setSystemTime(new Date(2098, 6, 3));
    const { full, cleanup } = await setupProposalWithThreeTests(false);

    const html = buildProposalHtml(full, null, null);

    // Ensaio A: 1000 + (1000/6000)*600 = 1100 | Ensaio B: 2000 + (2000/6000)*600 = 2200 | Ensaio C: 3000 + (3000/6000)*600 = 3300
    expect(html).toContain(formatCurrency(1100));
    expect(html).toContain(formatCurrency(2200));
    expect(html).toContain(formatCurrency(3300));
    expect(html).not.toContain("Custo adicional de teste");
    expect(html).toContain(`<tr><td>Valor total — Ponto Único</td><td class="text-right">${formatCurrency(6600)}</td></tr>`);
    expect(html).toContain(`<tr><td>Total de ensaios</td><td class="text-right">${formatCurrency(6600)}</td></tr>`);

    await cleanup();
    vi.useRealTimers();
  });

  it("'Demonstrar custo adicional?' = Sim: ensaios mantêm o valor original e o custo aparece em linha separada", async () => {
    vi.setSystemTime(new Date(2098, 6, 4));
    const { full, cleanup } = await setupProposalWithThreeTests(true);

    const html = buildProposalHtml(full, null, null);

    expect(html).toContain(formatCurrency(1000));
    expect(html).toContain(formatCurrency(2000));
    expect(html).toContain(formatCurrency(3000));
    expect(html).toContain("Custo adicional de teste");
    expect(html).toContain(`<tr><td>Valor total — Ponto Único</td><td class="text-right">${formatCurrency(6000)}</td></tr>`);
    expect(html).toContain(`<tr><td>Total de ensaios</td><td class="text-right">${formatCurrency(6000)}</td></tr>`);

    await cleanup();
    vi.useRealTimers();
  });

  it("o valor total da proposta é idêntico nas duas opções (Sim/Não só muda a apresentação, nunca o total)", async () => {
    vi.setSystemTime(new Date(2098, 6, 5));
    const sim = await setupProposalWithThreeTests(true);
    const nao = await setupProposalWithThreeTests(false);

    expect(Number(sim.full.totalValue)).toBe(Number(nao.full.totalValue));
    expect(Number(sim.full.totalValue)).toBe(6600);

    await sim.cleanup();
    await nao.cleanup();
    vi.useRealTimers();
  });
});

describe("Rateio do deslocamento entre os ensaios quando não exibido (PDF) — persistência real", () => {
  async function setupProposalWithTravel(params: { exhibitTravelValue: boolean; useAdditionalCosts?: boolean; otherCostsValue?: number }) {
    const { exhibitTravelValue, useAdditionalCosts = true, otherCostsValue = 0 } = params;
    const proposal = await createProposal(userId, {
      clientId,
      matrices: ["QUALIDADE_AR"],
      contactIds: [],
      exhibitUnitValue: true,
      useAdditionalCosts,
      exhibitTravelValue,
    });
    createdProposalIds.push(proposal.id);

    const point = await prisma.collectionPoint.create({ data: { clientId, matrix: "QUALIDADE_AR", name: "Ponto Único" } });
    await prisma.proposalCollectionPoint.create({ data: { proposalId: proposal.id, collectionPointId: point.id } });

    const suffix = randomUUID().slice(0, 6);
    const testA = await prisma.test.create({ data: { name: "Ensaio A", method: "M-A", unit: "mg/m³", parameterCode: `TVA-${suffix}`, value: 1000, matrix: "QUALIDADE_AR" } });
    const testB = await prisma.test.create({ data: { name: "Ensaio B", method: "M-B", unit: "mg/m³", parameterCode: `TVB-${suffix}`, value: 1000, matrix: "QUALIDADE_AR" } });
    const testC = await prisma.test.create({ data: { name: "Ensaio C", method: "M-C", unit: "mg/m³", parameterCode: `TVC-${suffix}`, value: 1000, matrix: "QUALIDADE_AR" } });

    await prisma.proposalTest.createMany({
      data: [
        { proposalId: proposal.id, testId: testA.id, collectionPointId: point.id, nameSnapshot: "Ensaio A", methodSnapshot: "M-A", unitSnapshot: "mg/m³", codeSnapshot: testA.parameterCode, valueSnapshot: 1000, quantity: 1 },
        { proposalId: proposal.id, testId: testB.id, collectionPointId: point.id, nameSnapshot: "Ensaio B", methodSnapshot: "M-B", unitSnapshot: "mg/m³", codeSnapshot: testB.parameterCode, valueSnapshot: 1000, quantity: 1 },
        { proposalId: proposal.id, testId: testC.id, collectionPointId: point.id, nameSnapshot: "Ensaio C", methodSnapshot: "M-C", unitSnapshot: "mg/m³", codeSnapshot: testC.parameterCode, valueSnapshot: 1000, quantity: 1 },
      ],
    });

    // Deslocamento de R$90,00 (distância 90km x R$1/km), distribuído por 3 ensaios = R$30,00 cada.
    await prisma.proposal.update({ where: { id: proposal.id }, data: { travelDistanceKm: 90, travelValuePerKm: 1 } });
    if (otherCostsValue > 0) {
      await prisma.proposalCost.create({ data: { proposalId: proposal.id, description: "Custo adicional de teste", value: otherCostsValue, type: "OUTRO" } });
    }
    await prisma.$transaction((tx) => recalculateProposalTotals(tx, proposal.id));

    const full = await prisma.proposal.findUniqueOrThrow({ where: { id: proposal.id }, include: proposalDetailInclude });

    return {
      proposal,
      full,
      cleanup: async () => {
        await prisma.proposalTest.deleteMany({ where: { proposalId: proposal.id } });
        await prisma.proposalCost.deleteMany({ where: { proposalId: proposal.id } });
        await prisma.test.deleteMany({ where: { id: { in: [testA.id, testB.id, testC.id] } } });
        await prisma.proposalCollectionPoint.deleteMany({ where: { proposalId: proposal.id } });
        await prisma.collectionPoint.deleteMany({ where: { id: point.id } });
      },
    };
  }

  it("'Exibir valor de deslocamento?' = Sim: ensaios mantêm o valor original e o deslocamento aparece em linha separada", async () => {
    vi.setSystemTime(new Date(2098, 6, 6));
    const { full, cleanup } = await setupProposalWithTravel({ exhibitTravelValue: true });

    const html = buildProposalHtml(full, null, null);

    expect(html).toContain(`<tr><td>Deslocamento</td><td class="text-right">${formatCurrency(90)}</td></tr>`);
    expect(html).toContain(`<tr><td>Valor total — Ponto Único</td><td class="text-right">${formatCurrency(3000)}</td></tr>`);
    expect(html).toContain(`<tr><td>Total de ensaios</td><td class="text-right">${formatCurrency(3000)}</td></tr>`);

    await cleanup();
    vi.useRealTimers();
  });

  it("'Exibir valor de deslocamento?' = Não: o valor é dividido IGUALMENTE pela quantidade de ensaios (não proporcional) e somado a cada um", async () => {
    vi.setSystemTime(new Date(2098, 6, 7));
    const { full, cleanup } = await setupProposalWithTravel({ exhibitTravelValue: false });

    const html = buildProposalHtml(full, null, null);

    // R$90 / 3 ensaios = R$30 cada -> 1000 + 30 = 1030 por ensaio
    expect(html).toContain(formatCurrency(1030));
    expect(html).not.toContain(`<tr><td>Deslocamento</td>`);
    expect(html).toContain(`<tr><td>Valor total — Ponto Único</td><td class="text-right">${formatCurrency(3090)}</td></tr>`);
    expect(html).toContain(`<tr><td>Total de ensaios</td><td class="text-right">${formatCurrency(3090)}</td></tr>`);

    await cleanup();
    vi.useRealTimers();
  });

  it("rateio do deslocamento e do custo adicional são independentes e se combinam no mesmo ensaio", async () => {
    vi.setSystemTime(new Date(2098, 6, 8));
    const { full, cleanup } = await setupProposalWithTravel({ exhibitTravelValue: false, useAdditionalCosts: false, otherCostsValue: 600 });

    const html = buildProposalHtml(full, null, null);

    // ensaios de valor igual (1000 cada): custo adicional 600/3=200 + deslocamento 90/3=30 -> 1000+200+30=1230 cada
    expect(html).toContain(formatCurrency(1230));
    expect(html).toContain(`<tr><td>Valor total — Ponto Único</td><td class="text-right">${formatCurrency(3690)}</td></tr>`);
    expect(html).toContain(`<tr><td>Total de ensaios</td><td class="text-right">${formatCurrency(3690)}</td></tr>`);
    expect(html).not.toContain("Custo adicional de teste");
    expect(html).not.toContain(`<tr><td>Deslocamento</td>`);

    await cleanup();
    vi.useRealTimers();
  });

  it("o valor total da proposta é idêntico exibindo ou não o deslocamento", async () => {
    vi.setSystemTime(new Date(2098, 6, 9));
    const sim = await setupProposalWithTravel({ exhibitTravelValue: true });
    const nao = await setupProposalWithTravel({ exhibitTravelValue: false });

    expect(Number(sim.full.totalValue)).toBe(Number(nao.full.totalValue));
    expect(Number(sim.full.totalValue)).toBe(3090);

    await sim.cleanup();
    await nao.cleanup();
    vi.useRealTimers();
  });
});
