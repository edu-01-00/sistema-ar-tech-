import { describe, expect, it } from "vitest";
import {
  formatProposalCode,
  isValidStatusTransition,
  validateSampleQuantity,
  computeProposalTotal,
  computeTravelTotal,
  nextRevisionCode,
  round2,
} from "@/lib/proposal-logic";

describe("formatProposalCode", () => {
  it("formata código com sequência, ano e revisão com zero à esquerda", () => {
    expect(formatProposalCode(1, 2026, 0)).toBe("PR-001/2026-R00");
    expect(formatProposalCode(23, 2026, 1)).toBe("PR-023/2026-R01");
    expect(formatProposalCode(999, 2027, 12)).toBe("PR-999/2027-R12");
  });
});

describe("nextRevisionCode", () => {
  it("incrementa a revisão mantendo sequência e ano", () => {
    const result = nextRevisionCode(1, 2026, 0);
    expect(result.revision).toBe(1);
    expect(result.code).toBe("PR-001/2026-R01");
  });

  it("permite múltiplas revisões sucessivas", () => {
    const first = nextRevisionCode(5, 2026, 0);
    const second = nextRevisionCode(5, 2026, first.revision);
    expect(second.revision).toBe(2);
    expect(second.code).toBe("PR-005/2026-R02");
  });
});

describe("isValidStatusTransition", () => {
  it("permite transições previstas no fluxo comercial", () => {
    expect(isValidStatusTransition("EM_ELABORACAO", "ENVIADA")).toBe(true);
    expect(isValidStatusTransition("ENVIADA", "APROVADA")).toBe(true);
    expect(isValidStatusTransition("ENVIADA", "NAO_APROVADA")).toBe(true);
    expect(isValidStatusTransition("NAO_APROVADA", "EM_ELABORACAO")).toBe(true);
  });

  it("rejeita pular etapas do fluxo", () => {
    expect(isValidStatusTransition("EM_ELABORACAO", "APROVADA")).toBe(false);
  });

  it("rejeita transições a partir de um estado final (CANCELADA)", () => {
    expect(isValidStatusTransition("CANCELADA", "EM_ELABORACAO")).toBe(false);
  });

  it("rejeita transição para o mesmo status", () => {
    expect(isValidStatusTransition("ENVIADA", "ENVIADA")).toBe(false);
  });
});

describe("validateSampleQuantity", () => {
  it("aceita zero e inteiros positivos", () => {
    expect(validateSampleQuantity(0)).toBe(true);
    expect(validateSampleQuantity(1)).toBe(true);
    expect(validateSampleQuantity(50)).toBe(true);
  });

  it("rejeita valores negativos", () => {
    expect(validateSampleQuantity(-1)).toBe(false);
  });

  it("rejeita valores não inteiros", () => {
    expect(validateSampleQuantity(1.5)).toBe(false);
  });
});

describe("computeTravelTotal", () => {
  it("calcula distância x valor por km + outros custos", () => {
    expect(computeTravelTotal({ distanceKm: 30, valuePerKm: 2.5, otherCosts: 20 })).toBe(95);
  });

  it("retorna 0 quando não há dados de deslocamento", () => {
    expect(computeTravelTotal(null)).toBe(0);
    expect(computeTravelTotal(undefined)).toBe(0);
  });

  it("trata campos ausentes como zero", () => {
    expect(computeTravelTotal({ distanceKm: 10 })).toBe(0);
  });
});

describe("computeProposalTotal", () => {
  it("soma ensaios (qtd x valor), outros custos e deslocamento", () => {
    const totals = computeProposalTotal({
      tests: [
        { quantity: 2, value: 100 },
        { quantity: 1, value: 50 },
      ],
      costs: [{ value: 250 }],
      travel: { distanceKm: 30, valuePerKm: 2.5, otherCosts: 0 },
    });

    expect(totals.testsTotal).toBe(250);
    expect(totals.otherCostsTotal).toBe(250);
    expect(totals.travelTotal).toBe(75);
    expect(totals.totalValue).toBe(575);
  });

  it("nunca produz total negativo a partir de entradas válidas", () => {
    const totals = computeProposalTotal({ tests: [], costs: [], travel: null });
    expect(totals.totalValue).toBe(0);
  });
});

describe("round2", () => {
  it("arredonda para duas casas decimais evitando erros de ponto flutuante", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(19.995)).toBeCloseTo(20, 2);
  });
});
