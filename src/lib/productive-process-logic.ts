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
