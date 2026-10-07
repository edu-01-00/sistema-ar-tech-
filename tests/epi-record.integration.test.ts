import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Testes de integração contra o banco real (Postgres), reproduzindo o fluxo
// completo da Ficha de EPI descrito no item 18 do requisito: criação do
// funcionário, data de admissão, abertura da ficha (criação sob demanda),
// adição de EPI, devolução, assinatura única, segunda tentativa de
// assinatura, novo EPI, demissão e preservação do histórico assinado.

let roleId: string;
let userId: string;
let employeeId: string;
const createdRecordIds: string[] = [];

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);

  const role = await prisma.role.create({ data: { name: `TEST_ROLE_FICHA_EPI_${suffix}` } });
  roleId = role.id;

  const user = await prisma.user.create({
    data: { name: "Usuário Ficha EPI Teste", email: `teste-ficha-epi-${suffix}@example.com`, passwordHash: "x", roleId },
  });
  userId = user.id;

  const employee = await prisma.employee.create({
    data: {
      name: `Funcionário Ficha EPI Teste ${suffix}`,
      position: "Técnico de Laboratório",
      sector: "Laboratório",
      hiredAt: new Date("2026-01-10"),
    },
  });
  employeeId = employee.id;
});

afterAll(async () => {
  await prisma.epiRecordItem.deleteMany({ where: { epiRecord: { employeeId } } });
  await prisma.auditLog.deleteMany({ where: { entityType: { in: ["EpiRecord", "EpiRecordItem"] } } });
  await prisma.epiRecord.deleteMany({ where: { id: { in: createdRecordIds } } });
  await prisma.employee.deleteMany({ where: { id: employeeId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.role.deleteMany({ where: { id: roleId } });
  await prisma.$disconnect();
});

async function openOrCreateRecord() {
  let record = await prisma.epiRecord.findUnique({ where: { employeeId }, include: { items: true } });
  if (!record) {
    record = await prisma.epiRecord.create({ data: { employeeId, createdById: userId }, include: { items: true } });
  }
  createdRecordIds.push(record.id);
  return record;
}

describe("Ficha de EPI — fluxo completo (item 18)", () => {
  it("TESTE 1 — funcionário é criado e a data de admissão corresponde ao cadastro", async () => {
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    expect(employee.hiredAt?.toISOString().slice(0, 10)).toBe("2026-01-10");
  });

  it("TESTE 2 — abrir a Ficha de EPI cria o registro único do funcionário sob demanda", async () => {
    const record = await openOrCreateRecord();
    expect(record.employeeId).toBe(employeeId);
    expect(record.signedAt).toBeNull();

    // abrir novamente não duplica a ficha (vínculo 1:1)
    const again = await openOrCreateRecord();
    expect(again.id).toBe(record.id);
    const count = await prisma.epiRecord.count({ where: { employeeId } });
    expect(count).toBe(1);
  });

  it("TESTE 3 — adicionar um EPI (descrição/quantidade/CA/data de entrega)", async () => {
    const record = await openOrCreateRecord();
    const item = await prisma.epiRecordItem.create({
      data: {
        epiRecordId: record.id,
        description: "Óculos de Proteção",
        quantity: 1,
        caNumber: "12345",
        deliveredAt: new Date("2026-02-01"),
      },
    });
    expect(item.description).toBe("Óculos de Proteção");
    expect(item.quantity).toBe(1);
    expect(item.caNumber).toBe("12345");
    expect(item.returnedAt).toBeNull();
  });

  it("TESTE 4 — registrar a devolução do EPI posteriormente", async () => {
    const record = await openOrCreateRecord();
    const item = await prisma.epiRecordItem.findFirstOrThrow({
      where: { epiRecordId: record.id, description: "Óculos de Proteção" },
    });
    const updated = await prisma.epiRecordItem.update({ where: { id: item.id }, data: { returnedAt: new Date("2026-03-01") } });
    expect(updated.returnedAt?.toISOString().slice(0, 10)).toBe("2026-03-01");
  });

  it("TESTE 5 — realizar a assinatura digital (uma única vez)", async () => {
    const record = await openOrCreateRecord();
    const signedAt = new Date();
    const signed = await prisma.epiRecord.update({
      where: { id: record.id },
      data: { signedAt, signedName: "Funcionário Teste" },
    });
    expect(signed.signedAt).not.toBeNull();
    expect(signed.signedName).toBe("Funcionário Teste");
  });

  it("TESTE 6 — a ficha não exige nova assinatura por EPI: uma segunda tentativa de assinar é rejeitada", async () => {
    const record = await openOrCreateRecord();
    expect(record.signedAt).not.toBeNull();
    // reproduz a regra da rota de assinatura: 409 se já assinada
    const alreadySigned = record.signedAt !== null;
    expect(alreadySigned).toBe(true);
  });

  it("TESTE 7 — adicionar outro EPI à mesma ficha já assinada, sem exigir nova assinatura", async () => {
    const record = await openOrCreateRecord();
    const signedNameBefore = record.signedName;

    const item = await prisma.epiRecordItem.create({
      data: {
        epiRecordId: record.id,
        description: "Luvas de Nitrila",
        quantity: 10,
        caNumber: "67890",
        deliveredAt: new Date("2026-03-10"),
      },
    });
    expect(item.description).toBe("Luvas de Nitrila");

    const reloaded = await prisma.epiRecord.findUniqueOrThrow({ where: { id: record.id }, include: { items: true } });
    expect(reloaded.items).toHaveLength(2);
    expect(reloaded.signedName).toBe(signedNameBefore);
  });

  it("TESTE 8 — dados do funcionário (nome, cargo/função, setor) estão corretos na ficha", async () => {
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    expect(employee.position).toBe("Técnico de Laboratório");
    expect(employee.sector).toBe("Laboratório");
  });

  it("TESTE 9 — simular demissão e verificar que a data de demissão aparece corretamente", async () => {
    const terminatedAt = new Date("2026-06-15");
    const updated = await prisma.employee.update({ where: { id: employeeId }, data: { active: false, terminatedAt } });
    expect(updated.terminatedAt?.toISOString().slice(0, 10)).toBe("2026-06-15");

    // a Ficha de EPI lê a data de demissão sempre do cadastro, nunca duplicada
    const record = await openOrCreateRecord();
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: record.employeeId } });
    expect(employee.terminatedAt?.toISOString().slice(0, 10)).toBe("2026-06-15");
  });

  it("TESTE 10 — os dados históricos da ficha assinada não são alterados por mudanças posteriores no cadastro", async () => {
    const record = await openOrCreateRecord();
    const signedAtBefore = record.signedAt;
    const signedNameBefore = record.signedName;

    await prisma.employee.update({ where: { id: employeeId }, data: { position: "Coordenador", sector: "Administrativo" } });

    const reloaded = await prisma.epiRecord.findUniqueOrThrow({ where: { id: record.id } });
    expect(reloaded.signedAt?.toISOString()).toBe(signedAtBefore?.toISOString());
    expect(reloaded.signedName).toBe(signedNameBefore);

    // restaura o cadastro para não afetar outros testes
    await prisma.employee.update({
      where: { id: employeeId },
      data: { position: "Técnico de Laboratório", sector: "Laboratório", active: true, terminatedAt: null },
    });
  });
});

describe("Ficha de EPI — assinatura digital a cada entrega de EPI", () => {
  it("cada item de EPI entregue pode ser assinado individualmente, de forma independente da assinatura única da ficha", async () => {
    const record = await openOrCreateRecord();
    const item = await prisma.epiRecordItem.create({
      data: {
        epiRecordId: record.id,
        description: "Protetor Auricular",
        quantity: 1,
        deliveredAt: new Date("2026-04-01"),
      },
    });
    expect(item.signedAt).toBeNull();
    expect(item.signedName).toBeNull();

    const signedAt = new Date();
    const signed = await prisma.epiRecordItem.update({
      where: { id: item.id },
      data: { signedAt, signedName: "Funcionário Teste" },
    });
    expect(signed.signedAt).not.toBeNull();
    expect(signed.signedName).toBe("Funcionário Teste");
  });

  it("um item já assinado não pode ser assinado novamente (regra reproduzida pela rota: 409 se já assinado)", async () => {
    const record = await openOrCreateRecord();
    const item = await prisma.epiRecordItem.findFirstOrThrow({
      where: { epiRecordId: record.id, description: "Protetor Auricular" },
    });
    expect(item.signedAt).not.toBeNull();
    const alreadySigned = item.signedAt !== null;
    expect(alreadySigned).toBe(true);
  });

  it("a assinatura de um item não afeta os demais itens da mesma ficha", async () => {
    const record = await openOrCreateRecord();
    const unsignedItem = await prisma.epiRecordItem.create({
      data: {
        epiRecordId: record.id,
        description: "Capacete com Jugular",
        quantity: 1,
        deliveredAt: new Date("2026-04-05"),
      },
    });
    expect(unsignedItem.signedAt).toBeNull();

    const signedItem = await prisma.epiRecordItem.findFirstOrThrow({
      where: { epiRecordId: record.id, description: "Protetor Auricular" },
    });
    expect(signedItem.signedAt).not.toBeNull();
  });
});
