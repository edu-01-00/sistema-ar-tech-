import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { LegislationForm } from "@/components/legislation/LegislationForm";

export default async function LegislacaoDetailPage({ params }: { params: { id: string } }) {
  const session = await requirePagePermission(["legislations.view", "legislations.manage"]);
  const canManage = hasPermission(session.user.permissions, "legislations.manage");

  const [legislation, tests] = await Promise.all([
    prisma.legislation.findUnique({ where: { id: params.id }, include: { legislationTests: { include: { test: true } } } }),
    prisma.test.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!legislation) notFound();

  return (
    <div>
      <PageHeader
        title={legislation.name}
        actions={
          <>
            <Badge className={legislation.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}>
              {legislation.active ? "Ativo" : "Inativo"}
            </Badge>
            {canManage && (
              <ConfirmButton
                url={`/api/legislations/${legislation.id}/deactivate`}
                method="PATCH"
                confirmMessage={legislation.active ? "Deseja desativar esta legislação?" : "Deseja reativar esta legislação?"}
                label={legislation.active ? "Desativar" : "Reativar"}
                className={legislation.active ? "btn-danger text-xs" : "btn-primary text-xs"}
              />
            )}
          </>
        }
      />
      <LegislationForm legislation={legislation} availableTests={tests} />
    </div>
  );
}
