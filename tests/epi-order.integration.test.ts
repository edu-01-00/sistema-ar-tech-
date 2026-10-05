import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generateEpiOrderCode } from "@/lib/services/epi-service";

// Testes de integração contra o banco real (Postgres), cobrindo os cenários
// obrigatórios de setor/cargo/data automática/histórico da Ordem de Serviço
// de EPI. Reproduz exatamente a mesma sequência da rota de criação
// (POST /api/employees/[id]/epi-orders): captura o snapshot de
// setor/cargo do funcionário no momento da criação.

let roleId: string;
let userId: string;
let employeeId: string;
let epiId: string;
const createdOrderIds: string[] = [];

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);

  const role = await prisma.role.create({ data: { name: `TEST_ROLE_EPI_${suffix}` } });
  roleId = role.id;

  const user = await prisma.user.create({
    data: { name: "Usuário EPI Teste", email: `teste-epi-${suffix}@example.com`, passwordHash: "x", roleId },
  });
  userId = user.id;

  const employee = await prisma.employee.create({
    data: { name: `Funcionário EPI Teste ${suffix}`, sector: "Laboratório", position: "Técnico de Laboratório" },
  });
  employeeId = employee.id;

  const epi = await prisma.epi.create({ data: { name: `EPI Teste ${suffix}` } });
  epiId = epi.id;
});

afterAll(async () => {
  await prisma.epiOrderItem.deleteMany({ where: { epiOrderId: { in: createdOrderIds } } });
  await prisma.auditLog.deleteMany({ where: { entityType: "EpiOrder", entityId: { in: createdOrderIds } } });
  await prisma.epiOrder.deleteMany({ where: { id: { in: createdOrderIds } } });
  await prisma.epi.deleteMany({ where: { id: epiId } });
  await prisma.employee.deleteMany({ where: { id: employeeId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.role.deleteMany({ where: { id: roleId } });
  await prisma.$disconnect();
});

async function createEpiOrder(activities: string | null = null) {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
  const beforeCreate = Date.now();

  const order = await prisma.$transaction(async (tx) => {
    const code = await generateEpiOrderCode(tx);
    return tx.epiOrder.create({
      data: {
        code,
        employeeId: employee.id,
        createdById: userId,
        activities,
        sectorSnapshot: employee.sector,
        positionSnapshot: employee.position,
        items: { create: [{ epiId, nameSnapshot: "EPI Teste" }] },
      },
      include: { items: true },
    });
  });
  createdOrderIds.push(order.id);
  return { order, beforeCreate };
}

describe("Ordem de Serviço de EPI — setor, cargo/função, data e histórico", () => {
  it("TESTE 1 — setor do funcionário é gravado no snapshot da OS", async () => {
    const { order } = await createEpiOrder();
    expect(order.sectorSnapshot).toBe("Laboratório");
  });

  it("TESTE 2 — cargo/função do funcionário é gravado no snapshot da OS", async () => {
    const { order } = await createEpiOrder();
    expect(order.positionSnapshot).toBe("Técnico de Laboratório");
  });

  it("TESTE 3 — data de emissão corresponde à data real de geração (gerada automaticamente)", async () => {
    const { order, beforeCreate } = await createEpiOrder();
    const afterCreate = Date.now();
    const issuedAtMs = order.issuedAt.getTime();
    expect(issuedAtMs).toBeGreaterThanOrEqual(beforeCreate - 1000);
    expect(issuedAtMs).toBeLessThanOrEqual(afterCreate + 1000);
  });

  it("TESTE 4 — atividades a serem realizadas são armazenadas junto com a OS", async () => {
    const { order } = await createEpiOrder("Realizar coleta e preparação das amostras.");
    expect(order.activities).toBe("Realizar coleta e preparação das amostras.");
  });

  it("TESTE 5 — EPIs selecionados ficam vinculados à OS", async () => {
    const { order } = await createEpiOrder();
    const items = await prisma.epiOrderItem.findMany({ where: { epiOrderId: order.id } });
    expect(items).toHaveLength(1);
    expect(items[0].nameSnapshot).toBe("EPI Teste");
  });

  it("TESTE 7 — alterar setor/cargo do funcionário depois não muda uma OS já emitida", async () => {
    const { order: originalOrder } = await createEpiOrder();
    expect(originalOrder.sectorSnapshot).toBe("Laboratório");
    expect(originalOrder.positionSnapshot).toBe("Técnico de Laboratório");

    await prisma.employee.update({
      where: { id: employeeId },
      data: { sector: "Administrativo", position: "Coordenador" },
    });

    const reloadedOrder = await prisma.epiOrder.findUniqueOrThrow({ where: { id: originalOrder.id } });
    expect(reloadedOrder.sectorSnapshot).toBe("Laboratório");
    expect(reloadedOrder.positionSnapshot).toBe("Técnico de Laboratório");

    // Uma nova OS emitida depois da alteração deve refletir os dados atuais.
    const { order: newOrder } = await createEpiOrder();
    expect(newOrder.sectorSnapshot).toBe("Administrativo");
    expect(newOrder.positionSnapshot).toBe("Coordenador");

    // restaura o cadastro para não afetar os demais testes deste arquivo
    await prisma.employee.update({ where: { id: employeeId }, data: { sector: "Laboratório", position: "Técnico de Laboratório" } });
  });
});
