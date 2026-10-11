import { describe, expect, it } from "vitest";
import {
  formatProductiveProcessCode,
  formatServiceOrderCode,
  isValidProductiveProcessStatusTransition,
  computeMatrixAggregateStatus,
} from "@/lib/productive-process-logic";

describe("formatProductiveProcessCode", () => {
  it("formata com número sequencial de 3 dígitos e ano", () => {
    expect(formatProductiveProcessCode(127, 2026)).toBe("PP 127/2026");
    expect(formatProductiveProcessCode(1, 2026)).toBe("PP 001/2026");
    expect(formatProductiveProcessCode(1, 2027)).toBe("PP 001/2027");
  });
});

describe("formatServiceOrderCode", () => {
  it("formata reaproveitando o número-base do Processo Produtivo", () => {
    expect(formatServiceOrderCode(127, 2026, 1)).toBe("OS 127/2026_1");
    expect(formatServiceOrderCode(127, 2026, 2)).toBe("OS 127/2026_2");
    expect(formatServiceOrderCode(1, 2026, 1)).toBe("OS 001/2026_1");
  });
});

describe("isValidProductiveProcessStatusTransition", () => {
  it("permite o caminho feliz completo: PLANEJADO -> ... -> VALIDADO", () => {
    expect(isValidProductiveProcessStatusTransition("PLANEJADO", "AGENDADO")).toBe(true);
    expect(isValidProductiveProcessStatusTransition("AGENDADO", "EM_CAMPO")).toBe(true);
    expect(isValidProductiveProcessStatusTransition("EM_CAMPO", "RECEBIDO_CUSTODIA")).toBe(true);
    expect(isValidProductiveProcessStatusTransition("RECEBIDO_CUSTODIA", "EM_ANALISE")).toBe(true);
    expect(isValidProductiveProcessStatusTransition("EM_ANALISE", "VALIDADO")).toBe(true);
  });

  it("permite rejeitar a amostra a partir de RECEBIDO_CUSTODIA", () => {
    expect(isValidProductiveProcessStatusTransition("RECEBIDO_CUSTODIA", "REJEITADO")).toBe(true);
  });

  it("permite cancelar a partir de qualquer status não-terminal", () => {
    expect(isValidProductiveProcessStatusTransition("PLANEJADO", "CANCELADO")).toBe(true);
    expect(isValidProductiveProcessStatusTransition("AGENDADO", "CANCELADO")).toBe(true);
    expect(isValidProductiveProcessStatusTransition("EM_CAMPO", "CANCELADO")).toBe(true);
    expect(isValidProductiveProcessStatusTransition("RECEBIDO_CUSTODIA", "CANCELADO")).toBe(true);
    expect(isValidProductiveProcessStatusTransition("EM_ANALISE", "CANCELADO")).toBe(true);
  });

  it("não permite pular fases", () => {
    expect(isValidProductiveProcessStatusTransition("PLANEJADO", "EM_CAMPO")).toBe(false);
    expect(isValidProductiveProcessStatusTransition("PLANEJADO", "VALIDADO")).toBe(false);
    expect(isValidProductiveProcessStatusTransition("AGENDADO", "RECEBIDO_CUSTODIA")).toBe(false);
  });

  it("status terminais (VALIDADO, REJEITADO, CANCELADO) não permitem nenhuma transição", () => {
    expect(isValidProductiveProcessStatusTransition("VALIDADO", "EM_ANALISE")).toBe(false);
    expect(isValidProductiveProcessStatusTransition("REJEITADO", "EM_ANALISE")).toBe(false);
    expect(isValidProductiveProcessStatusTransition("CANCELADO", "PLANEJADO")).toBe(false);
  });

  it("não permite transição para o mesmo status", () => {
    expect(isValidProductiveProcessStatusTransition("EM_CAMPO", "EM_CAMPO")).toBe(false);
  });
});

describe("computeMatrixAggregateStatus", () => {
  it("retorna null para lista vazia (nenhum processo nessa matriz)", () => {
    expect(computeMatrixAggregateStatus([])).toBeNull();
  });

  it("retorna VALIDADO somente quando TODOS os processos estão validados", () => {
    expect(computeMatrixAggregateStatus(["VALIDADO", "VALIDADO"])).toBe("VALIDADO");
    expect(computeMatrixAggregateStatus(["VALIDADO", "EM_ANALISE"])).toBe("EM_ANALISE");
  });

  it("REJEITADO tem prioridade sobre qualquer outro status (precisa de atenção)", () => {
    expect(computeMatrixAggregateStatus(["VALIDADO", "REJEITADO"])).toBe("REJEITADO");
    expect(computeMatrixAggregateStatus(["EM_ANALISE", "REJEITADO", "PLANEJADO"])).toBe("REJEITADO");
  });

  it("CANCELADO tem prioridade logo abaixo de REJEITADO", () => {
    expect(computeMatrixAggregateStatus(["VALIDADO", "CANCELADO"])).toBe("CANCELADO");
    expect(computeMatrixAggregateStatus(["CANCELADO", "REJEITADO"])).toBe("REJEITADO");
  });

  it("sem rejeição/cancelamento, mostra o status menos avançado (elo mais fraco)", () => {
    expect(computeMatrixAggregateStatus(["EM_ANALISE", "PLANEJADO", "AGENDADO"])).toBe("PLANEJADO");
  });

  it("um único processo reflete diretamente seu próprio status", () => {
    expect(computeMatrixAggregateStatus(["EM_CAMPO"])).toBe("EM_CAMPO");
  });
});
