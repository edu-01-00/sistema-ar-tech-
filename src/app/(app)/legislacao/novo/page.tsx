import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { LegislationForm } from "@/components/legislation/LegislationForm";

export default async function NovaLegislacaoPage() {
  const session = await requirePagePermission(["legislations.manage"]);
  const canManageUnits = hasPermission(session.user.permissions, "measurement_units.manage");
  const [tests, measurementUnits] = await Promise.all([
    prisma.test.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.measurementUnit.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Nova Legislação" />
      <LegislationForm availableTests={tests} measurementUnits={measurementUnits} canManageUnits={canManageUnits} />
    </div>
  );
}
