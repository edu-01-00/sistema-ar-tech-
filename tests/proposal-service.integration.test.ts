import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createProposal, createProposalRevision, changeProposalStatus } from "@/lib/services/proposal-service";
import { ApiError } from "@/lib/api-helpers";

// Testes de integração contra o banco de desenvolvimento real (Postgres),
// cobrindo as regras mais críticas de propostas: geração de código único,
// reinício da numeração por ano, controle de revisão e transições de status.
// Usa anos "de teste" (2098/2099) exclusivos para não colidir com dados
// reais/seed, e remove tudo o que cria ao final.

let roleId: string;
let userId: string;
let clientId: string;
const createdProposalIds: string[] = [];

beforeAll(async () => {
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
  await prisma.proposal.deleteMany({ where: { id: { in: createdProposalIds } } });
  await prisma.client.deleteMany({ where: { id: clientId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.role.deleteMany({ where: { id: roleId } });
  await prisma.$disconnect();
});

describe("createProposal - geração de código e reinício anual", () => {
  it("gera códigos sequenciais únicos dentro do mesmo ano", async () => {
    vi.setSystemTime(new Date(2098, 0, 15));

    const first = await createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [] });
    const second = await createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [] });
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
    const proposal = await createProposal(userId, { clientId, matrices: ["RUIDO_AMBIENTAL"], contactIds: [] });
    createdProposalIds.push(proposal.id);

    expect(proposal.year).toBe(2099);
    expect(proposal.sequenceNumber).toBe(1);
    expect(proposal.code).toBe("PR-001/2099-R00");

    vi.useRealTimers();
  });

  it("nunca gera dois códigos duplicados mesmo com criação concorrente", async () => {
    vi.setSystemTime(new Date(2098, 5, 1));

    const results = await Promise.all(
      Array.from({ length: 5 }).map(() => createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [] })),
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
    const original = await createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [] });
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
    const original = await createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [] });
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
    const proposal = await createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [] });
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
    const proposal = await createProposal(userId, { clientId, matrices: ["QUALIDADE_AR"], contactIds: [] });
    createdProposalIds.push(proposal.id);

    await expect(changeProposalStatus(userId, proposal.id, "APROVADA")).rejects.toThrow(ApiError);

    vi.useRealTimers();
  });
});
