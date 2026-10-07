// Funções puras (sem acesso a banco) relacionadas às regras de negócio de
// propostas. Mantidas isoladas para permitir testes unitários rápidos e
// confiáveis (ver tests/proposal-logic.test.ts).

export function formatProposalCode(sequenceNumber: number, year: number, revision: number): string {
  const sequence = String(sequenceNumber).padStart(3, "0");
  const revisionStr = String(revision).padStart(2, "0");
  return `PR-${sequence}/${year}-R${revisionStr}`;
}

export const PROPOSAL_STATUS_VALUES = [
  "EM_ELABORACAO",
  "ENVIADA",
  "APROVADA",
  "NAO_APROVADA",
  "CANCELADA",
] as const;
export type ProposalStatusValue = (typeof PROPOSAL_STATUS_VALUES)[number];

export const ALLOWED_STATUS_TRANSITIONS: Record<ProposalStatusValue, ProposalStatusValue[]> = {
  EM_ELABORACAO: ["ENVIADA", "CANCELADA"],
  ENVIADA: ["APROVADA", "NAO_APROVADA", "CANCELADA"],
  APROVADA: ["CANCELADA"],
  NAO_APROVADA: ["EM_ELABORACAO", "CANCELADA"],
  CANCELADA: [],
};

export function isValidStatusTransition(current: ProposalStatusValue, next: ProposalStatusValue): boolean {
  if (current === next) return false;
  return ALLOWED_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}

export function validateSampleQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 0;
}

export interface ProposalTestLine {
  quantity: number;
  value: number;
}

export interface ProposalCostLine {
  value: number;
}

export interface ProposalTravelInput {
  distanceKm?: number | null;
  valuePerKm?: number | null;
  otherCosts?: number | null;
}

export function computeTravelTotal(travel: ProposalTravelInput | null | undefined): number {
  if (!travel) return 0;
  const distance = travel.distanceKm ?? 0;
  const valuePerKm = travel.valuePerKm ?? 0;
  const otherCosts = travel.otherCosts ?? 0;
  return round2(distance * valuePerKm + otherCosts);
}

export function computeTestsTotal(tests: ProposalTestLine[]): number {
  return round2(tests.reduce((acc, t) => acc + t.quantity * t.value, 0));
}

export function computeOtherCostsTotal(costs: ProposalCostLine[]): number {
  return round2(costs.reduce((acc, c) => acc + c.value, 0));
}

// Custo adicional (ProposalCost) e deslocamento SEMPRE compõem o valor-base
// da proposta, independente das opções `useAdditionalCosts`/
// `exhibitTravelValue` — essas opções controlam apenas a FORMA de
// apresentação (linha separada, ou distribuído/omitido), nunca o cálculo do
// total (item 4, 5 e 8 do requisito de desconto/custo adicional: "o total
// final da proposta deve continuar incluindo 100% do custo adicional").
// O desconto percentual é aplicado sobre esse valor-base único — nunca
// sobre um valor que já exclua custos que fazem parte da proposta.
export function computeProposalTotal(params: {
  tests: ProposalTestLine[];
  costs: ProposalCostLine[];
  travel: ProposalTravelInput | null | undefined;
  discountPercent?: number | null;
}): {
  testsTotal: number;
  otherCostsTotal: number;
  travelTotal: number;
  baseValue: number;
  discountValue: number;
  totalValue: number;
} {
  const testsTotal = computeTestsTotal(params.tests);
  const otherCostsTotal = computeOtherCostsTotal(params.costs);
  const travelTotal = computeTravelTotal(params.travel);
  const baseValue = round2(testsTotal + otherCostsTotal + travelTotal);
  const discountPercent = params.discountPercent ?? 0;
  const discountValue = round2((baseValue * discountPercent) / 100);
  const totalValue = round2(baseValue - discountValue);
  return { testsTotal, otherCostsTotal, travelTotal, baseValue, discountValue, totalValue };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Distribui um valor proporcionalmente a `weights` (ex.: o valor de cada
// ensaio/ponto na proposta) sem perder nem sobrar centavos por
// arredondamento: calcula a parte inteira de cada cota em centavos e aloca
// os centavos restantes aos itens com maior parte fracionária (método dos
// maiores restos), garantindo soma EXATAMENTE igual ao valor original.
// Quando todos os pesos são zero (nenhuma base para proporção), cai para
// distribuição igual entre os itens — o valor nunca deixa de ser distribuído.
export function distributeAmountProportionally(totalValue: number, weights: number[]): number[] {
  if (weights.length === 0 || totalValue === 0) return weights.map(() => 0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const effectiveWeights = totalWeight > 0 ? weights : weights.map(() => 1);
  const effectiveTotalWeight = totalWeight > 0 ? totalWeight : weights.length;
  const totalCents = Math.round(totalValue * 100);
  const rawShares = effectiveWeights.map((w) => (totalCents * w) / effectiveTotalWeight);
  const shareCents = rawShares.map((v) => Math.floor(v));
  let remainderCents = totalCents - shareCents.reduce((a, b) => a + b, 0);
  const byFractionDesc = rawShares
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < byFractionDesc.length && remainderCents > 0; k++, remainderCents--) {
    shareCents[byFractionDesc[k].i] += 1;
  }
  return shareCents.map((cents) => cents / 100);
}

export interface PointSubtotalInput {
  key: string;
  testsSubtotal: number;
}

export interface PointDisplaySubtotal {
  key: string;
  displaySubtotal: number;
}

// Centraliza a regra de exibição do custo adicional: quando
// `distributeOtherCosts` é falso ("demonstrar custo adicional" = Sim), cada
// ponto mostra apenas o seu próprio subtotal de ensaios, e o custo aparece
// como linha separada. Quando verdadeiro ("demonstrar" = Não), o valor de
// `otherCostsTotal` é distribuído de forma PROPORCIONAL entre os ensaios da
// proposta — na prática, o peso de cada ponto é a soma do valor dos seus
// próprios ensaios (`testsSubtotal`), então distribuir proporcionalmente por
// ponto usando esse peso é matematicamente idêntico a distribuir ensaio a
// ensaio e depois somar por ponto. O custo nunca desaparece do total, só
// muda a forma de apresentação.
export function computePointDisplaySubtotals(params: {
  points: PointSubtotalInput[];
  otherCostsTotal: number;
  distributeOtherCosts: boolean;
}): PointDisplaySubtotal[] {
  const { points, otherCostsTotal, distributeOtherCosts } = params;
  if (!distributeOtherCosts || points.length === 0 || otherCostsTotal === 0) {
    return points.map((p) => ({ key: p.key, displaySubtotal: p.testsSubtotal }));
  }
  const shares = distributeAmountProportionally(
    otherCostsTotal,
    points.map((p) => p.testsSubtotal),
  );
  return points.map((p, i) => ({ key: p.key, displaySubtotal: round2(p.testsSubtotal + shares[i]) }));
}

// "Total de ensaios" exibido no Resumo Comercial: sempre a soma exata dos
// subtotais exibidos por ponto, para que a linha de total nunca destoe das
// linhas individuais (item 15: fonte única de cálculo reutilizada em todas
// as telas e no PDF).
export function sumDisplaySubtotals(subtotals: PointDisplaySubtotal[]): number {
  return round2(subtotals.reduce((acc, s) => acc + s.displaySubtotal, 0));
}

export function nextRevisionCode(sequenceNumber: number, year: number, currentRevision: number): {
  revision: number;
  code: string;
} {
  const revision = currentRevision + 1;
  return { revision, code: formatProposalCode(sequenceNumber, year, revision) };
}

// Texto automático da forma de pagamento (item 19 do documento de ajustes):
// gerado dinamicamente a partir dos dias informados, em vez de um texto fixo
// pré-selecionado. Para pagamento parcelado, a 1ª parcela vence em 15 ou 30
// dias e as demais vencem a cada 30 dias a partir dela.
export function buildPaymentConditionText(params: {
  paymentMethod: string | null | undefined;
  paymentDueDays: number | null | undefined;
  installments: number | null | undefined;
  firstInstallmentDueDays: number | null | undefined;
}): string | null {
  const { paymentMethod, paymentDueDays, installments, firstInstallmentDueDays } = params;

  if (paymentMethod === "PARCELADO") {
    if (!firstInstallmentDueDays || !installments || installments < 1) return null;
    const dueDays = Array.from({ length: installments }, (_, i) => firstInstallmentDueDays + i * 30);
    const [first, ...rest] = dueDays;
    if (rest.length === 0) {
      return `Vencimento da 1ª parcela em ${first} dias após a finalização dos trabalhos de campo.`;
    }
    return `Vencimento da 1ª parcela em ${first} dias e as demais em ${rest.join("/")} dias, após a finalização dos trabalhos de campo.`;
  }

  if (paymentMethod === "A_VISTA" || paymentMethod === "BOLETO" || paymentMethod === "DEPOSITO_PIX") {
    if (!paymentDueDays) return null;
    return `Vencimento para ${paymentDueDays} dias assim que for finalizado os trabalhos de campo.`;
  }

  return null;
}
