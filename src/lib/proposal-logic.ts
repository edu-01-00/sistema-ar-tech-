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

export function computeProposalTotal(params: {
  tests: ProposalTestLine[];
  costs: ProposalCostLine[];
  travel: ProposalTravelInput | null | undefined;
}): { testsTotal: number; otherCostsTotal: number; travelTotal: number; totalValue: number } {
  const testsTotal = computeTestsTotal(params.tests);
  const otherCostsTotal = computeOtherCostsTotal(params.costs);
  const travelTotal = computeTravelTotal(params.travel);
  const totalValue = round2(testsTotal + otherCostsTotal + travelTotal);
  return { testsTotal, otherCostsTotal, travelTotal, totalValue };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function nextRevisionCode(sequenceNumber: number, year: number, currentRevision: number): {
  revision: number;
  code: string;
} {
  const revision = currentRevision + 1;
  return { revision, code: formatProposalCode(sequenceNumber, year, revision) };
}
