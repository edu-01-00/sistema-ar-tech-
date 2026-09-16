import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { TestForm } from "@/components/tests/TestForm";

export default async function EnsaioDetailPage({ params }: { params: { id: string } }) {
  const session = await requirePagePermission(["tests.view", "tests.manage"]);
  const canManage = hasPermission(session.user.permissions, "tests.manage");

  const test = await prisma.test.findUnique({ where: { id: params.id } });
  if (!test) notFound();

  return (
    <div>
      <PageHeader
        title={test.name}
        actions={
          <>
            <Badge className={test.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}>
              {test.active ? "Ativo" : "Inativo"}
            </Badge>
            {canManage && (
              <ConfirmButton
                url={`/api/tests/${test.id}/deactivate`}
                method="PATCH"
                confirmMessage={test.active ? "Deseja desativar este ensaio?" : "Deseja reativar este ensaio?"}
                label={test.active ? "Desativar" : "Reativar"}
                className={test.active ? "btn-danger text-xs" : "btn-primary text-xs"}
              />
            )}
          </>
        }
      />
      <TestForm test={test} />
    </div>
  );
}
