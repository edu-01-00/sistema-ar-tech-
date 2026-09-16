import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { CollectionPointForm } from "@/components/collection-points/CollectionPointForm";

export default async function NovoPontoColetaPage({ searchParams }: { searchParams: { clientId?: string } }) {
  await requirePagePermission(["collection_points.manage"]);

  const [clients, tests, legislations] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, orderBy: { corporateName: "asc" } }),
    prisma.test.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.legislation.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Novo Ponto de Coleta" />
      <CollectionPointForm clients={clients} tests={tests} legislations={legislations} defaultClientId={searchParams.clientId} />
    </div>
  );
}
