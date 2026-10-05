import { describe, expect, it } from "vitest";
import {
  formatProposalCode,
  isValidStatusTransition,
  validateSampleQuantity,
  computeProposalTotal,
  computeTravelTotal,
  nextRevisionCode,
  round2,
  buildPaymentConditionText,
  distributeAmountEqually,
  computePointDisplaySubtotals,
  sumDisplaySubtotals,
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

  // Alteração de regra (item 4/5/8 do requisito de desconto/custo
  // adicional): custo adicional e deslocamento SEMPRE compõem o total,
  // mesmo quando não demonstrados separadamente — a opção de exibição
  // (useAdditionalCosts) afeta só a apresentação, nunca o cálculo.
  it("custo adicional e deslocamento sempre compõem o total, demonstrados ou não", () => {
    const totals = computeProposalTotal({
      tests: [{ quantity: 2, value: 100 }],
      costs: [{ value: 250 }],
      travel: { distanceKm: 30, valuePerKm: 2.5, otherCosts: 0 },
    });

    expect(totals.testsTotal).toBe(200);
    expect(totals.otherCostsTotal).toBe(250);
    expect(totals.travelTotal).toBe(75);
    expect(totals.baseValue).toBe(525);
    expect(totals.totalValue).toBe(525);
  });

  it("TESTE 1 (sem desconto): valor final igual ao valor-base", () => {
    const totals = computeProposalTotal({
      tests: [{ quantity: 1, value: 2440 }],
      costs: [],
      travel: null,
    });
    expect(totals.baseValue).toBe(2440);
    expect(totals.discountValue).toBe(0);
    expect(totals.totalValue).toBe(2440);
  });

  it("TESTE 2 (desconto de 3%): desconto e valor final calculados corretamente", () => {
    const totals = computeProposalTotal({
      tests: [{ quantity: 1, value: 2440 }],
      costs: [],
      travel: null,
      discountPercent: 3,
    });
    expect(totals.baseValue).toBe(2440);
    expect(totals.discountValue).toBe(73.2);
    expect(totals.totalValue).toBe(2366.8);
  });

  it("TESTE 5 (desconto + custo adicional): desconto calculado sobre o valor-base completo", () => {
    // Custo adicional não demonstrado distribuído nos ensaios (R$1000 + R$800 + R$100 = R$1900 de base),
    // depois desconto de 3% sobre o valor-base completo (nunca sobre um valor que já exclua o custo).
    const totals = computeProposalTotal({
      tests: [
        { quantity: 1, value: 1000 },
        { quantity: 1, value: 800 },
      ],
      costs: [{ value: 100 }],
      travel: null,
      discountPercent: 3,
    });
    expect(totals.baseValue).toBe(1900);
    expect(totals.discountValue).toBe(57);
    expect(totals.totalValue).toBe(1843);
  });
});

describe("distributeAmountEqually", () => {
  it("TESTE 4 (custo adicional não demonstrado): distribui igualmente entre os pontos", () => {
    expect(distributeAmountEqually(100, 2)).toEqual([50, 50]);
  });

  it("TESTE 6 (arredondamento): a soma das parcelas é exatamente igual ao valor original", () => {
    const shares = distributeAmountEqually(100, 3);
    expect(shares).toHaveLength(3);
    const sum = shares.reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(100);
    // 100 / 3 = 33.33... -> 33.33 + 33.33 + 33.34 (ajuste no último item)
    expect(shares[0]).toBe(33.33);
    expect(shares[1]).toBe(33.33);
    expect(shares[2]).toBe(33.34);
  });

  it("retorna lista vazia sem dividir por zero", () => {
    expect(distributeAmountEqually(100, 0)).toEqual([]);
    expect(distributeAmountEqually(0, 3)).toEqual([]);
  });
});

describe("computePointDisplaySubtotals / sumDisplaySubtotals", () => {
  it("TESTE 3 (custo adicional demonstrado): subtotal de cada ponto permanece só com os ensaios", () => {
    const subtotals = computePointDisplaySubtotals({
      points: [
        { key: "p1", testsSubtotal: 1000 },
        { key: "p2", testsSubtotal: 800 },
      ],
      otherCostsTotal: 100,
      distributeOtherCosts: false,
    });
    expect(subtotals).toEqual([
      { key: "p1", displaySubtotal: 1000 },
      { key: "p2", displaySubtotal: 800 },
    ]);
    expect(sumDisplaySubtotals(subtotals)).toBe(1800);
  });

  it("TESTE 4 (custo adicional não demonstrado): incorpora a distribuição em cada ponto", () => {
    const subtotals = computePointDisplaySubtotals({
      points: [
        { key: "p1", testsSubtotal: 1000 },
        { key: "p2", testsSubtotal: 800 },
      ],
      otherCostsTotal: 100,
      distributeOtherCosts: true,
    });
    expect(subtotals).toEqual([
      { key: "p1", displaySubtotal: 1050 },
      { key: "p2", displaySubtotal: 850 },
    ]);
    expect(sumDisplaySubtotals(subtotals)).toBe(1900);
  });

  it("não distribui para lista vazia de pontos", () => {
    const subtotals = computePointDisplaySubtotals({ points: [], otherCostsTotal: 100, distributeOtherCosts: true });
    expect(subtotals).toEqual([]);
    expect(sumDisplaySubtotals(subtotals)).toBe(0);
  });
});

describe("round2", () => {
  it("arredonda para duas casas decimais evitando erros de ponto flutuante", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(19.995)).toBeCloseTo(20, 2);
  });
});

describe("buildPaymentConditionText", () => {
  it("gera texto dinâmico para à vista com os dias informados", () => {
    const text = buildPaymentConditionText({ paymentMethod: "A_VISTA", paymentDueDays: 30, installments: null, firstInstallmentDueDays: null });
    expect(text).toBe("Vencimento para 30 dias assim que for finalizado os trabalhos de campo.");
  });

  it("gera texto dinâmico para boleto/depósito-pix com outro número de dias", () => {
    expect(buildPaymentConditionText({ paymentMethod: "BOLETO", paymentDueDays: 45, installments: null, firstInstallmentDueDays: null })).toContain("45 dias");
    expect(buildPaymentConditionText({ paymentMethod: "DEPOSITO_PIX", paymentDueDays: 15, installments: null, firstInstallmentDueDays: null })).toContain("15 dias");
  });

  it("retorna null quando os dias não foram informados", () => {
    expect(buildPaymentConditionText({ paymentMethod: "A_VISTA", paymentDueDays: null, installments: null, firstInstallmentDueDays: null })).toBeNull();
  });

  it("gera sequência de vencimentos de 30 em 30 dias para parcelado", () => {
    const text = buildPaymentConditionText({ paymentMethod: "PARCELADO", paymentDueDays: null, installments: 4, firstInstallmentDueDays: 15 });
    expect(text).toBe("Vencimento da 1ª parcela em 15 dias e as demais em 45/75/105 dias, após a finalização dos trabalhos de campo.");
  });

  it("gera texto correto quando a 1ª parcela vence em 30 dias", () => {
    const text = buildPaymentConditionText({ paymentMethod: "PARCELADO", paymentDueDays: null, installments: 2, firstInstallmentDueDays: 30 });
    expect(text).toBe("Vencimento da 1ª parcela em 30 dias e as demais em 60 dias, após a finalização dos trabalhos de campo.");
  });

  it("retorna null para parcelado sem os dados necessários", () => {
    expect(buildPaymentConditionText({ paymentMethod: "PARCELADO", paymentDueDays: null, installments: null, firstInstallmentDueDays: 15 })).toBeNull();
    expect(buildPaymentConditionText({ paymentMethod: "PARCELADO", paymentDueDays: null, installments: 3, firstInstallmentDueDays: null })).toBeNull();
  });

  it("retorna null quando a forma de pagamento não foi definida", () => {
    expect(buildPaymentConditionText({ paymentMethod: null, paymentDueDays: 30, installments: null, firstInstallmentDueDays: null })).toBeNull();
  });
});
