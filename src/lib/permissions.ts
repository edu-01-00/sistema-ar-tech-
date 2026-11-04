// Catálogo central de permissões do sistema.
// Cada entrada vira uma linha na tabela `permissions` (ver prisma/seed.ts).
// As permissões são checadas tanto no frontend (esconder botões/menus)
// quanto no backend (rotas de API), que é a camada que realmente protege os dados.

export type PermissionKey =
  | "company.view"
  | "company.manage"
  | "company.documents.manage"
  | "employees.view"
  | "employees.manage"
  | "employees.documents.manage"
  | "employees.epi.manage"
  | "users.manage"
  | "roles.manage"
  | "tests.view"
  | "tests.manage"
  | "measurement_units.manage"
  | "legislations.view"
  | "legislations.manage"
  | "clients.view"
  | "clients.manage"
  | "collection_points.view"
  | "collection_points.manage"
  | "proposals.view"
  | "proposals.manage"
  | "proposals.status.change"
  | "settings.manage"
  | "audit.view";

export const PERMISSIONS: { key: PermissionKey; description: string; module: string }[] = [
  { key: "company.view", description: "Visualizar dados da empresa", module: "Empresa" },
  { key: "company.manage", description: "Editar dados da empresa", module: "Empresa" },
  { key: "company.documents.manage", description: "Gerenciar documentos da empresa", module: "Empresa" },

  { key: "employees.view", description: "Visualizar funcionários", module: "Funcionários" },
  { key: "employees.manage", description: "Cadastrar/editar/desativar funcionários", module: "Funcionários" },
  { key: "employees.documents.manage", description: "Gerenciar documentos de funcionários", module: "Funcionários" },
  { key: "employees.epi.manage", description: "Gerar ordens de serviço de EPI", module: "Funcionários" },

  { key: "users.manage", description: "Gerenciar usuários e níveis de acesso", module: "Configurações" },
  { key: "roles.manage", description: "Gerenciar papéis e permissões", module: "Configurações" },
  { key: "settings.manage", description: "Editar textos técnicos e configurações gerais", module: "Configurações" },
  { key: "audit.view", description: "Visualizar histórico/auditoria", module: "Configurações" },

  { key: "tests.view", description: "Visualizar ensaios", module: "Ensaios" },
  { key: "tests.manage", description: "Cadastrar/editar/desativar ensaios", module: "Ensaios" },
  { key: "measurement_units.manage", description: "Cadastrar/desativar unidades de medida (usadas em ensaios e legislação)", module: "Ensaios" },

  { key: "legislations.view", description: "Visualizar legislações", module: "Legislação" },
  { key: "legislations.manage", description: "Cadastrar/editar/desativar legislações", module: "Legislação" },

  { key: "clients.view", description: "Visualizar clientes", module: "Clientes" },
  { key: "clients.manage", description: "Cadastrar/editar/desativar clientes e contatos", module: "Clientes" },

  { key: "collection_points.view", description: "Visualizar pontos de coleta", module: "Pontos de Coleta" },
  { key: "collection_points.manage", description: "Cadastrar/editar/desativar pontos de coleta", module: "Pontos de Coleta" },

  { key: "proposals.view", description: "Visualizar propostas", module: "Propostas" },
  { key: "proposals.manage", description: "Criar, editar e revisar propostas", module: "Propostas" },
  { key: "proposals.status.change", description: "Alterar status das propostas", module: "Propostas" },
];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export function hasPermission(userPermissions: string[] | undefined, key: PermissionKey): boolean {
  if (!userPermissions) return false;
  return userPermissions.includes(key);
}

export function hasAnyPermission(userPermissions: string[] | undefined, keys: PermissionKey[]): boolean {
  if (!userPermissions) return false;
  return keys.some((k) => userPermissions.includes(k));
}
