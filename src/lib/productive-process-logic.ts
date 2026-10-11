// Funções puras (sem acesso a banco) relacionadas às regras de negócio de
// Processo Produtivo e Ordem de Serviço. Mantidas isoladas para permitir
// testes unitários rápidos e confiáveis, no mesmo padrão de proposal-logic.ts.

// Formato: "PP 001/2026" — número sequencial (3 dígitos) + ano.
export function formatProductiveProcessCode(sequenceNumber: number, year: number): string {
  const sequence = String(sequenceNumber).padStart(3, "0");
  return `PP ${sequence}/${year}`;
}

// Formato: "OS 001/2026_1" — reaproveita o número-base (sequência/ano) do
// Processo Produtivo de origem, seguido do número da Ordem de Serviço
// dentro daquele Processo Produtivo (1, 2, 3...).
export function formatServiceOrderCode(productiveProcessSequenceNumber: number, productiveProcessYear: number, sequenceInProcess: number): string {
  const sequence = String(productiveProcessSequenceNumber).padStart(3, "0");
  return `OS ${sequence}/${productiveProcessYear}_${sequenceInProcess}`;
}

// =========================================================================
// CAMPANHA DE MONITORAMENTO — status do ciclo de vida técnico (ISO 17025)
// =========================================================================
// Cada ProductiveProcess (1 por ponto de coleta, portanto 1 por matriz/ponto)
// evolui de forma independente pelas 4 fases exigidas pela ISO 17025:
// Plano de Amostragem -> Entrada e Custódia -> Checagem/Aceitação ->
// Resultados. A maior parte das transições acontece como efeito colateral
// de registrar os dados da fase (ver productive-process-service.ts); apenas
// "marcar coleta em campo concluída", "validar resultados" e "cancelar" são
// ações explícitas do usuário.
export const PRODUCTIVE_PROCESS_STATUS_VALUES = [
  "PLANEJADO",
  "AGENDADO",
  "EM_CAMPO",
  "RECEBIDO_CUSTODIA",
  "EM_ANALISE",
  "VALIDADO",
  "REJEITADO",
  "CANCELADO",
] as const;
export type ProductiveProcessStatusValue = (typeof PRODUCTIVE_PROCESS_STATUS_VALUES)[number];

export const ALLOWED_PP_STATUS_TRANSITIONS: Record<ProductiveProcessStatusValue, ProductiveProcessStatusValue[]> = {
  PLANEJADO: ["AGENDADO", "CANCELADO"],
  AGENDADO: ["EM_CAMPO", "CANCELADO"],
  EM_CAMPO: ["RECEBIDO_CUSTODIA", "CANCELADO"],
  RECEBIDO_CUSTODIA: ["EM_ANALISE", "REJEITADO", "CANCELADO"],
  EM_ANALISE: ["VALIDADO", "CANCELADO"],
  VALIDADO: [],
  REJEITADO: [],
  CANCELADO: [],
};

export function isValidProductiveProcessStatusTransition(current: ProductiveProcessStatusValue, next: ProductiveProcessStatusValue): boolean {
  if (current === next) return false;
  return ALLOWED_PP_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}

// Status exibido no cabeçalho da aba de uma matriz: o "elo mais fraco" entre
// os processos daquela matriz. REJEITADO/CANCELADO têm prioridade máxima
// (precisam de atenção), e só mostra VALIDADO quando TODOS os processos da
// matriz estiverem validados.
const STATUS_PRIORITY: Record<ProductiveProcessStatusValue, number> = {
  REJEITADO: 0,
  CANCELADO: 1,
  PLANEJADO: 2,
  AGENDADO: 3,
  EM_CAMPO: 4,
  RECEBIDO_CUSTODIA: 5,
  EM_ANALISE: 6,
  VALIDADO: 7,
};

export function computeMatrixAggregateStatus(statuses: ProductiveProcessStatusValue[]): ProductiveProcessStatusValue | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((worst, s) => (STATUS_PRIORITY[s] < STATUS_PRIORITY[worst] ? s : worst));
}
