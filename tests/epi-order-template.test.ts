import { describe, expect, it } from "vitest";
import type { Employee, EpiOrder, EpiOrderItem } from "@prisma/client";
import { buildEpiOrderHtml } from "@/lib/pdf/epi-order-template";

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    name: "Carlos Mendes",
    cpf: null,
    email: null,
    phone: null,
    position: "Analista",
    sector: "Qualidade",
    registrationNumber: null,
    hiredAt: null,
    terminatedAt: null,
    active: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeOrder(overrides: Partial<EpiOrder> = {}, items: EpiOrderItem[] = []): EpiOrder & { items: EpiOrderItem[] } {
  return {
    id: "order-1",
    code: "OS-EPI-0001",
    employeeId: "emp-1",
    status: "PENDENTE",
    issuedAt: new Date("2026-10-05T10:00:00Z"),
    acceptedAt: null,
    acceptedName: null,
    storageKey: null,
    createdById: "user-1",
    createdAt: new Date("2026-10-05T10:00:00Z"),
    activities: null,
    sectorSnapshot: "Laboratório",
    positionSnapshot: "Técnico de Laboratório",
    items,
    ...overrides,
  };
}

function makeItem(overrides: Partial<EpiOrderItem> = {}): EpiOrderItem {
  return { id: "item-1", epiOrderId: "order-1", epiId: "epi-1", nameSnapshot: "Óculos de Proteção", ...overrides };
}

describe("buildEpiOrderHtml", () => {
  it("TESTE 1 — exibe o setor vindo do snapshot da OS", () => {
    const html = buildEpiOrderHtml(makeOrder({ sectorSnapshot: "Laboratório" }), makeEmployee(), null);
    expect(html).toContain("<strong>Setor:</strong> Laboratório");
  });

  it("TESTE 2 — exibe o Cargo/Função vindo do snapshot da OS", () => {
    const html = buildEpiOrderHtml(makeOrder({ positionSnapshot: "Técnico de Laboratório" }), makeEmployee(), null);
    expect(html).toContain("<strong>Cargo/Função:</strong> Técnico de Laboratório");
  });

  it("TESTE 3 — exibe a data de emissão (issuedAt) formatada", () => {
    const issuedAt = new Date("2026-10-05T10:00:00Z");
    const html = buildEpiOrderHtml(makeOrder({ issuedAt }), makeEmployee(), null);
    expect(html).toContain("<strong>Emitida em:</strong>");
  });

  it("TESTE 4 — exibe o texto de atividades a serem realizadas quando informado", () => {
    const html = buildEpiOrderHtml(makeOrder({ activities: "Realizar coleta e preparação das amostras." }), makeEmployee(), null);
    expect(html).toContain("<strong>Atividades a serem realizadas:</strong> Realizar coleta e preparação das amostras.");
  });

  it("não exibe a linha de atividades quando não informada (não inventa obrigatoriedade)", () => {
    const html = buildEpiOrderHtml(makeOrder({ activities: null }), makeEmployee(), null);
    expect(html).not.toContain("Atividades a serem realizadas");
  });

  it("TESTE 5 — exibe todos os EPIs selecionados", () => {
    const items = [
      makeItem({ id: "i1", nameSnapshot: "Óculos de Proteção" }),
      makeItem({ id: "i2", nameSnapshot: "Luvas de Nitrila" }),
      makeItem({ id: "i3", nameSnapshot: "Protetor Auricular" }),
    ];
    const html = buildEpiOrderHtml(makeOrder({}, items), makeEmployee(), null);
    expect(html).toContain("Óculos de Proteção");
    expect(html).toContain("Luvas de Nitrila");
    expect(html).toContain("Protetor Auricular");
  });

  it("TESTE 6 — exibe a assinatura/declaração de concordância quando aceita", () => {
    const html = buildEpiOrderHtml(
      makeOrder({ status: "ACEITO", acceptedAt: new Date("2026-10-06T12:00:00Z"), acceptedName: "Carlos Mendes" }),
      makeEmployee(),
      null,
    );
    expect(html).toContain("Declaração de concordância");
    expect(html).toContain("Carlos Mendes");
    expect(html).not.toContain("Aceite pendente");
  });

  it("exibe aviso de aceite pendente quando a OS ainda não foi assinada", () => {
    const html = buildEpiOrderHtml(makeOrder({ status: "PENDENTE", acceptedAt: null }), makeEmployee(), null);
    expect(html).toContain("Aceite pendente de confirmação pelo funcionário.");
  });

  it("usa o dado atual do cadastro quando a OS não possui snapshot (compatibilidade com OS antigas)", () => {
    const html = buildEpiOrderHtml(
      makeOrder({ sectorSnapshot: null, positionSnapshot: null }),
      makeEmployee({ sector: "Administrativo", position: "Assistente" }),
      null,
    );
    expect(html).toContain("<strong>Setor:</strong> Administrativo");
    expect(html).toContain("<strong>Cargo/Função:</strong> Assistente");
  });
});
