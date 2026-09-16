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
import { DocumentManager } from "@/components/documents/DocumentManager";
import { EMPLOYEE_DOCUMENT_CATEGORY_LABELS } from "@/lib/format";

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

  const documentCategories = Object.entries(EMPLOYEE_DOCUMENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

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
        </div>
      </div>
    </div>
  );
}
