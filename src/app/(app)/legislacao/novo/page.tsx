import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { LegislationForm } from "@/components/legislation/LegislationForm";

export default async function NovaLegislacaoPage() {
  await requirePagePermission(["legislations.manage"]);
  const tests = await prisma.test.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader title="Nova Legislação" />
      <LegislationForm availableTests={tests} />
    </div>
  );
}
