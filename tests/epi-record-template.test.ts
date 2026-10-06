import { describe, expect, it } from "vitest";
import type { Employee, EpiRecord, EpiRecordItem } from "@prisma/client";
import { buildEpiRecordHtml } from "@/lib/pdf/epi-record-template";

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp-1",
    name: "Maria Oliveira",
    cpf: null,
    email: null,
    phone: null,
    position: "Técnica de Laboratório",
    sector: "Laboratório",
    registrationNumber: null,
    hiredAt: new Date("2026-01-10"),
    terminatedAt: null,
    active: true,
    createdAt: new Date("2026-01-10"),
    updatedAt: new Date("2026-01-10"),
    ...overrides,
  };
}

function makeRecord(overrides: Partial<EpiRecord> = {}, items: EpiRecordItem[] = []): EpiRecord & { items: EpiRecordItem[] } {
  return {
    id: "record-1",
    employeeId: "emp-1",
    signedAt: null,
    signedName: null,
    storageKey: null,
    createdById: "user-1",
    createdAt: new Date("2026-01-10"),
    items,
    ...overrides,
  };
}

function makeItem(overrides: Partial<EpiRecordItem> = {}): EpiRecordItem {
  return {
    id: "item-1",
    epiRecordId: "record-1",
    description: "Óculos de Proteção",
    quantity: 1,
    caNumber: "12345",
    deliveredAt: new Date("2026-01-10"),
    returnedAt: null,
    createdAt: new Date("2026-01-10"),
    ...overrides,
  };
}

describe("buildEpiRecordHtml", () => {
  it("exibe a declaração exata fornecida, sem alterar seu sentido", () => {
    const html = buildEpiRecordHtml(makeRecord(), makeEmployee(), null);
    expect(html).toContain("conforme preceitua a NR-6 e NR-1");
    expect(html).toContain("Lei nº 6.514");
    expect(html).toContain("portaria nº 3.214 de 08/06/78");
    expect(html).toContain("CLT artigos 157, 158, 462");
    expect(html).toContain("Em caso de dano causado pelo empregado ou sua ocorrência de dolo o desconto será lícito.");
  });

  it("exibe a data de admissão vinda do cadastro do funcionário", () => {
    const html = buildEpiRecordHtml(makeRecord(), makeEmployee({ hiredAt: new Date("2026-02-15") }), null);
    expect(html).toContain("<strong>Data de admissão:</strong>");
    expect(html).toContain("15/02/2026");
  });

  it("não exibe data de demissão quando o funcionário está ativo", () => {
    const html = buildEpiRecordHtml(makeRecord(), makeEmployee({ terminatedAt: null }), null);
    expect(html).not.toContain("Data de demissão");
  });

  it("exibe a data de demissão quando preenchida no cadastro", () => {
    const html = buildEpiRecordHtml(makeRecord(), makeEmployee({ terminatedAt: new Date("2026-06-01") }), null);
    expect(html).toContain("<strong>Data de demissão:</strong>");
    expect(html).toContain("01/06/2026");
  });

  it("exibe aviso de assinatura pendente quando a ficha ainda não foi assinada", () => {
    const html = buildEpiRecordHtml(makeRecord({ signedAt: null }), makeEmployee(), null);
    expect(html).toContain("Assinatura pendente de confirmação pelo funcionário.");
  });

  it("exibe o nome e a data/hora da assinatura digital quando assinada", () => {
    const html = buildEpiRecordHtml(
      makeRecord({ signedAt: new Date("2026-01-12T14:30:00Z"), signedName: "Maria Oliveira" }),
      makeEmployee(),
      null,
    );
    expect(html).toContain("<strong>Assinatura digital:</strong> Maria Oliveira");
    expect(html).toContain("<strong>Data/hora da assinatura:</strong>");
    expect(html).not.toContain("Assinatura pendente");
  });

  it("exibe todos os EPIs registrados com descrição, quantidade, CA e datas", () => {
    const items = [
      makeItem({ id: "i1", description: "Óculos de Proteção", quantity: 2, caNumber: "111" }),
      makeItem({ id: "i2", description: "Luvas de Nitrila", quantity: 5, caNumber: "222", returnedAt: new Date("2026-03-01") }),
    ];
    const html = buildEpiRecordHtml(makeRecord({}, items), makeEmployee(), null);
    expect(html).toContain("Óculos de Proteção");
    expect(html).toContain("Luvas de Nitrila");
    expect(html).toContain("111");
    expect(html).toContain("222");
    expect(html).toContain("01/03/2026");
  });

  it("exibe '-' na devolução quando o EPI ainda não foi devolvido", () => {
    const html = buildEpiRecordHtml(makeRecord({}, [makeItem({ returnedAt: null })]), makeEmployee(), null);
    expect(html).toContain("<td class=\"center\">-</td>");
  });

  it("não inventa IP de assinatura (dado não registrado pelo mecanismo atual)", () => {
    const html = buildEpiRecordHtml(
      makeRecord({ signedAt: new Date("2026-01-12T14:30:00Z"), signedName: "Maria Oliveira" }),
      makeEmployee(),
      null,
    );
    expect(html.toLowerCase()).not.toContain("endereço ip");
    expect(html).not.toContain("IP:");
  });
});
