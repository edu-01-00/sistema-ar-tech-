import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { CollectionPointForm } from "@/components/collection-points/CollectionPointForm";

export default async function PontoColetaDetailPage({ params }: { params: { id: string } }) {
  const session = await requirePagePermission(["collection_points.view", "collection_points.manage"]);
  const canManage = hasPermission(session.user.permissions, "collection_points.manage");

  const [point, clients, tests, legislations] = await Promise.all([
    prisma.collectionPoint.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        airQualityDetail: true,
        atmosphericDetail: true,
        noiseDetail: true,
        collectionPointTests: { include: { test: true } },
        collectionPointLegislations: { include: { legislation: true } },
      },
    }),
    prisma.client.findMany({ where: { active: true }, orderBy: { corporateName: "asc" } }),
    prisma.test.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.legislation.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!point) notFound();

  return (
    <div>
      <PageHeader
        title={point.name}
        description={`Cliente: ${point.client.corporateName}`}
        actions={
          <>
            <Badge className={point.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}>
              {point.active ? "Ativo" : "Inativo"}
            </Badge>
            {canManage && (
              <ConfirmButton
                url={`/api/collection-points/${point.id}/deactivate`}
                method="PATCH"
                confirmMessage={point.active ? "Deseja desativar este ponto de coleta?" : "Deseja reativar este ponto de coleta?"}
                label={point.active ? "Desativar" : "Reativar"}
                className={point.active ? "btn-danger text-xs" : "btn-primary text-xs"}
              />
            )}
          </>
        }
      />
      <CollectionPointForm point={point} clients={clients} tests={tests} legislations={legislations} />
    </div>
  );
}
