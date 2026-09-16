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
