import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { TestForm } from "@/components/tests/TestForm";

export default async function NovoEnsaioPage() {
  const session = await requirePagePermission(["tests.manage"]);
  const canManageUnits = hasPermission(session.user.permissions, "measurement_units.manage");
  const measurementUnits = await prisma.measurementUnit.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader title="Novo Ensaio" />
      <TestForm measurementUnits={measurementUnits} canManageUnits={canManageUnits} />
    </div>
  );
}
