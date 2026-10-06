import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { EmployeeForm } from "@/components/employees/EmployeeForm";
import { EmployeeUserPanel } from "@/components/employees/EmployeeUserPanel";
import { EpiOrdersPanel } from "@/components/employees/EpiOrdersPanel";
import { EpiRecordPanel } from "@/components/employees/EpiRecordPanel";
import { DocumentManager } from "@/components/documents/DocumentManager";
import { EMPLOYEE_DOCUMENT_CATEGORY_LABELS, formatDate } from "@/lib/format";

export default async function FuncionarioDetailPage({ params }: { params: { id: string } }) {
  const session = await requirePagePermission(["employees.view", "employees.manage"]);
  const canManage = hasPermission(session.user.permissions, "employees.manage");
  const canManageDocs = hasPermission(session.user.permissions, "employees.documents.manage");
  const canManageUsers = hasPermission(session.user.permissions, "users.manage");
  const canManageEpi = hasPermission(session.user.permissions, "employees.epi.manage");

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, email: true, active: true, roleId: true, role: { select: { name: true } } } },
      documents: { orderBy: { createdAt: "desc" } },
      epiOrders: { include: { items: true }, orderBy: { issuedAt: "desc" } },
    },
  });
  if (!employee) notFound();

  const [roles, epis] = await Promise.all([
    canManageUsers ? prisma.role.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    canManageEpi ? prisma.epi.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  // Ficha de EPI: vínculo único por funcionário. Busca a ficha existente ou
  // cria uma vazia na primeira visita à tela (não há formulário de criação
  // separado — a ficha apenas agrupa funcionário + itens de EPI + assinatura).
  let epiRecord = canManageEpi
    ? await prisma.epiRecord.findUnique({ where: { employeeId: employee.id }, include: { items: { orderBy: { createdAt: "asc" } } } })
    : null;
  if (canManageEpi && !epiRecord) {
    epiRecord = await prisma.epiRecord
      .create({
        data: { employeeId: employee.id, createdById: session.user.id },
        include: { items: { orderBy: { createdAt: "asc" } } },
      })
      .catch(() =>
        prisma.epiRecord.findUniqueOrThrow({ where: { employeeId: employee.id }, include: { items: { orderBy: { createdAt: "asc" } } } }),
      );
  }

  // Item 3: documentos do funcionário reorganizados em dois grupos —
  // "Contratação" e "Segurança do Trabalho / Cursos" (que também cobre exames).
  const DOCUMENT_CATEGORY_GROUPS: Record<string, string> = {
    CONTRATACAO: "Contratação",
    SEGURANCA_TRABALHO: "Segurança do Trabalho / Cursos",
    CURSO: "Segurança do Trabalho / Cursos",
    EXAME: "Segurança do Trabalho / Cursos",
    OUTRO: "Outros",
  };
  const documentCategories = Object.entries(EMPLOYEE_DOCUMENT_CATEGORY_LABELS).map(([value, label]) => ({
    value,
    label,
    group: DOCUMENT_CATEGORY_GROUPS[value],
  }));

  return (
    <div>
      <PageHeader
        title={employee.name}
        description={employee.position ?? undefined}
        actions={
          <>
            <Badge className={employee.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}>
              {employee.active ? "Ativo" : "Inativo"}
            </Badge>
            {canManage && (
              <ConfirmButton
                url={`/api/employees/${employee.id}/deactivate`}
                method="PATCH"
                confirmMessage={employee.active ? "Deseja desativar este funcionário?" : "Deseja reativar este funcionário?"}
                label={employee.active ? "Desativar" : "Reativar"}
                className={employee.active ? "btn-danger text-xs" : "btn-primary text-xs"}
              />
            )}
          </>
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <EmployeeForm employee={employee} />
          {canManageUsers && (
            <EmployeeUserPanel
              employeeId={employee.id}
              user={employee.user}
              roles={roles}
            />
          )}
        </div>

        <div className="space-y-6">
          <DocumentManager
            documents={employee.documents.map((d) => ({ ...d, categoryLabel: EMPLOYEE_DOCUMENT_CATEGORY_LABELS[d.category] }))}
            documentsBaseUrl={`/api/employees/${employee.id}/documents`}
            canManage={canManageDocs}
            categories={documentCategories}
          />

          {canManageEpi && <EpiOrdersPanel employeeId={employee.id} epis={epis} orders={employee.epiOrders} />}

          {canManageEpi && epiRecord && (
            <EpiRecordPanel
              employeeId={employee.id}
              record={epiRecord}
              admissionLabel={employee.hiredAt ? formatDate(employee.hiredAt) : "-"}
              terminationLabel={employee.terminatedAt ? formatDate(employee.terminatedAt) : null}
            />
          )}
        </div>
      </div>
    </div>
  );
}
