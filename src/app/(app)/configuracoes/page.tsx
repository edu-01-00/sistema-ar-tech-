import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { RolesPermissionsPanel } from "@/components/settings/RolesPermissionsPanel";
import { TechnicalTextsPanel } from "@/components/settings/TechnicalTextsPanel";
import { ProposalTextTemplatesPanel } from "@/components/settings/ProposalTextTemplatesPanel";
import { formatDateTime } from "@/lib/format";

export default async function ConfiguracoesPage() {
  const session = await requirePagePermission(["users.manage", "roles.manage", "settings.manage", "audit.view"]);
  const canManageRoles = hasPermission(session.user.permissions, "roles.manage");
  const canManageUsers = hasPermission(session.user.permissions, "users.manage");
  const canManageSettings = hasPermission(session.user.permissions, "settings.manage");
  const canViewAudit = hasPermission(session.user.permissions, "audit.view");

  const [roles, users, technicalTexts, proposalTextTemplates, auditLogs] = await Promise.all([
    canManageRoles
      ? prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } }, _count: { select: { users: true } } }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    canManageUsers ? prisma.user.findMany({ include: { role: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    canManageSettings ? prisma.technicalText.findMany() : Promise.resolve([]),
    canManageSettings ? prisma.proposalTextTemplate.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] }) : Promise.resolve([]),
    canViewAudit ? prisma.auditLog.findMany({ include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Usuários, permissões, textos técnicos e auditoria do sistema." />

      {canManageUsers && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Usuários</h2>
          <table className="table-base">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Status</th>
                <th>Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role.name}</td>
                  <td>{u.active ? "Ativo" : "Inativo"}</td>
                  <td>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca acessou"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-2">Para criar um novo login, acesse o cadastro do funcionário correspondente.</p>
        </div>
      )}

      {canManageRoles && <RolesPermissionsPanel roles={roles} />}

      {canManageSettings && (
        <TechnicalTextsPanel texts={technicalTexts.map((t) => ({ matrix: t.matrix, title: t.title, content: t.content }))} />
      )}

      {canManageSettings && (
        <ProposalTextTemplatesPanel
          templates={proposalTextTemplates.map((t) => ({
            id: t.id,
            category: t.category,
            matrix: t.matrix,
            name: t.name,
            content: t.content,
            active: t.active,
          }))}
        />
      )}

      {canViewAudit && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Histórico / Auditoria</h2>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum registro encontrado.</p>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Data/hora</th>
                    <th>Usuário</th>
                    <th>Ação</th>
                    <th>Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      <td>{log.user?.name ?? "Sistema"}</td>
                      <td>{log.action}</td>
                      <td>{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
