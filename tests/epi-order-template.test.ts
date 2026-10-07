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
  it("exibe o título ORDEM DE SERVIÇO SEGURANÇA E SAÚDE DO TRABALHO", () => {
    const html = buildEpiOrderHtml(makeOrder(), makeEmployee(), null);
    expect(html).toContain("ORDEM DE SERVIÇO SEGURANÇA E SAÚDE DO TRABALHO");
  });

  it("exibe o setor vindo do snapshot da OS", () => {
    const html = buildEpiOrderHtml(makeOrder({ sectorSnapshot: "Laboratório" }), makeEmployee(), null);
    expect(html).toContain("<strong>Setor:</strong> Laboratório");
  });

  it("exibe a Função vinda do snapshot da OS", () => {
    const html = buildEpiOrderHtml(makeOrder({ positionSnapshot: "Técnico de Laboratório" }), makeEmployee(), null);
    expect(html).toContain("<strong>Função:</strong> Técnico de Laboratório");
  });

  it("exibe o Nº de registro do funcionário, ou '-' quando não informado", () => {
    const comRegistro = buildEpiOrderHtml(makeOrder(), makeEmployee({ registrationNumber: "Sócio" }), null);
    expect(comRegistro).toContain("<strong>Nº de registro:</strong> Sócio");

    const semRegistro = buildEpiOrderHtml(makeOrder(), makeEmployee({ registrationNumber: null }), null);
    expect(semRegistro).toContain("<strong>Nº de registro:</strong> -");
  });

  it("exibe a data de emissão (issuedAt) formatada", () => {
    const issuedAt = new Date("2026-10-05T10:00:00Z");
    const html = buildEpiOrderHtml(makeOrder({ issuedAt }), makeEmployee(), null);
    expect(html).toContain("<strong>Emitida em:</strong>");
  });

  it("exibe o texto de atividades a serem realizadas quando informado", () => {
    const html = buildEpiOrderHtml(makeOrder({ activities: "Realizar coleta e preparação das amostras." }), makeEmployee(), null);
    expect(html).toContain("<strong>Atividades a serem realizadas:</strong> Realizar coleta e preparação das amostras.");
  });

  it("não exibe a linha de atividades quando não informada (não inventa obrigatoriedade)", () => {
    const html = buildEpiOrderHtml(makeOrder({ activities: null }), makeEmployee(), null);
    expect(html).not.toContain("Atividades a serem realizadas");
  });

  it("exibe todos os EPIs selecionados", () => {
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

  it("exibe o checklist de RECOMENDAÇÕES DE SEGURANÇA", () => {
    const html = buildEpiOrderHtml(makeOrder(), makeEmployee(), null);
    expect(html).toContain("RECOMENDAÇÕES DE SEGURANÇA:");
    expect(html).toContain("Não transite sem o uso de EPI em área de Risco;");
    expect(html).toContain("Ao acessar as escadas e transitar nas plataformas utilizar sempre o corrimão.");
  });

  it("exibe o checklist de ORIENTAÇÕES DE SEGURANÇA DO TRABALHO", () => {
    const html = buildEpiOrderHtml(makeOrder(), makeEmployee(), null);
    expect(html).toContain("ORIENTAÇÕES DE SEGURANÇA DO TRABALHO:");
    expect(html).toContain("Verifique as condições gerais do ambiente antes do trabalho;");
    expect(html).toContain("Cumprir as normas internas da empresa em que se realiza a atividade");
  });

  it("exibe o parágrafo das Normas Regulamentadoras com as referências em itálico", () => {
    const html = buildEpiOrderHtml(makeOrder(), makeEmployee(), null);
    expect(html).toContain("Esta ordem de serviço tem como objetivo prevenir atos inseguros");
    expect(html).toContain("<em>NR-1, item 1,7</em>");
    expect(html).toContain("<em>NR-9 – Programa de Riscos ambientais</em>");
    expect(html).toContain("<em>NR-6 Equipamento de Proteção individual EPI</em>");
    expect(html).toContain("<em>NR-35 trabalho em altura</em>");
    expect(html).toContain("<em>NR -17 Ergonomia</em>");
  });

  it("exibe o título DECLARAÇÃO e o texto fixo da declaração, independente do status de aceite", () => {
    const pendente = buildEpiOrderHtml(makeOrder({ acceptedAt: null }), makeEmployee(), null);
    expect(pendente).toContain("DECLARAÇÃO:");
    expect(pendente).toContain("Declaro que recebi as orientações e treinamento que fazem parte desta Ordem de Serviço");

    const aceita = buildEpiOrderHtml(
      makeOrder({ status: "ACEITO", acceptedAt: new Date("2026-10-06T12:00:00Z"), acceptedName: "Carlos Mendes" }),
      makeEmployee(),
      null,
    );
    expect(aceita).toContain("DECLARAÇÃO:");
    expect(aceita).toContain("Declaro que recebi as orientações e treinamento que fazem parte desta Ordem de Serviço");
  });

  it("exibe a assinatura digital (nome + data/hora) quando a OS foi aceita", () => {
    const html = buildEpiOrderHtml(
      makeOrder({ status: "ACEITO", acceptedAt: new Date("2026-10-06T12:00:00Z"), acceptedName: "Carlos Mendes" }),
      makeEmployee(),
      null,
    );
    expect(html).toContain("Assinado digitalmente por");
    expect(html).toContain("Carlos Mendes");
    expect(html).toContain("<strong>Data/hora da assinatura:</strong>");
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
    expect(html).toContain("<strong>Função:</strong> Assistente");
  });

  it("o nome da empresa no cabeçalho fica em uma única linha (sem quebra)", () => {
    const html = buildEpiOrderHtml(makeOrder(), makeEmployee(), null);
    expect(html).toContain("white-space: nowrap;");
  });
});
