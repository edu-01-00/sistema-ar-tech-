export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? Number(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("pt-BR");
}

export const MATRIX_LABELS: Record<string, string> = {
  EMISSOES_ATMOSFERICAS: "Emissões Atmosféricas",
  QUALIDADE_AR: "Qualidade do Ar",
  RUIDO_AMBIENTAL: "Ruído Ambiental",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  A_VISTA: "À vista",
  PARCELADO: "Parcelado",
  BOLETO: "Boleto",
  DEPOSITO_PIX: "Depósito / PIX",
};

export const PAYMENT_TERM_LABELS: Record<string, string> = {
  DIAS_15: "15 dias",
  DIAS_30: "30 dias",
  DIAS_15_30: "15/30 dias (dividido)",
  DIAS_30_60_90: "30/60/90 dias",
};

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  EM_ELABORACAO: "Em elaboração",
  ENVIADA: "Enviada",
  APROVADA: "Aprovada",
  NAO_APROVADA: "Não aprovada",
  CANCELADA: "Cancelada",
};

export const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  EM_ELABORACAO: "bg-gray-100 text-gray-700",
  ENVIADA: "bg-blue-100 text-blue-700",
  APROVADA: "bg-green-100 text-green-700",
  NAO_APROVADA: "bg-red-100 text-red-700",
  CANCELADA: "bg-red-100 text-red-800",
};

export const EMPLOYEE_DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  CONTRATACAO: "Contratação",
  SEGURANCA_TRABALHO: "Segurança do Trabalho",
  CURSO: "Curso",
  EXAME: "Exame",
  OUTRO: "Outro",
};

export const CHIMNEY_INSTALLATION_YEAR_LABELS: Record<string, string> = {
  ANTERIOR_2007: "Anterior a 02/01/2007",
  POSTERIOR_2007: "Posterior a 02/01/2007",
};

export const CHIMNEY_ACCESS_TYPE_LABELS: Record<string, string> = {
  PLATAFORMA_FIXA: "Plataforma Fixa",
  PLATAFORMA_ELEVATORIA: "Plataforma elevatória",
  SOLO: "Solo",
  CAMINHAO_MUNCK: "Caminhão Munck",
  TELHADO: "Telhado",
};

export const CHIMNEY_COVERAGE_LABELS: Record<string, string> = {
  COBERTO: "Coberto",
  DESCOBERTO: "Descoberto",
};

export const CHIMNEY_GEOMETRY_LABELS: Record<string, string> = {
  RETANGULAR: "Retangular",
  CIRCULAR: "Circular",
  QUADRADA: "Quadrada",
};

export const ATMOSPHERIC_EMISSION_TYPE_LABELS: Record<string, string> = {
  COMBUSTAO: "Combustão",
  PROCESSO: "Processo",
  NAO_APLICADO: "Não aplicado",
};

export const ATMOSPHERIC_COMBUSTION_TYPE_LABELS: Record<string, string> = {
  EXTERNA: "Externa",
  NAO_EXTERNA: "Não externa",
  NAO_APLICADO: "Não aplicado",
};

export const OPERATIONAL_CYCLE_LABELS: Record<string, string> = {
  CONTINUO: "Contínuo",
  NAO_CONTINUO: "Não Contínuo",
};

export const FUEL_CONSUMPTION_UNIT_LABELS: Record<string, string> = {
  L_H: "L/h",
  M3_H: "m³/h",
  KG_H: "Kg/h",
};

export const PROPOSAL_TEXT_CATEGORY_LABELS: Record<string, string> = {
  FORMA_PAGAMENTO_30: "Forma de Pagamento — condição 30 dias",
  FORMA_PAGAMENTO_15_30: "Forma de Pagamento — condição 15/30 dias",
  DECLARACAO_CONFORMIDADE: "Declaração da Conformidade e Regra de Decisão",
  VALIDADE_PROPOSTA: "Validade da Proposta",
  PRAZO_ENTREGA_RELATORIO: "Prazo de Entrega do Relatório",
  OBSERVACAO_IMPORTANTE: "Observações Importantes",
  PROTECAO_PROPRIEDADE_CLIENTE: "Proteção da Propriedade do Cliente",
  CONFIRMACAO_PROPOSTA: "Confirmação da Proposta / Dúvidas",
  OUTRAS_INFORMACOES: "Outras Informações",
};
