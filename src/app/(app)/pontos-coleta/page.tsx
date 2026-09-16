import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { MatrixFilter } from "@/components/tests/MatrixFilter";
import { MATRIX_LABELS } from "@/lib/format";
import { TEST_MATRIX_VALUES } from "@/lib/validations/test";

export default async function PontosColetaPage({ searchParams }: { searchParams: { q?: string; matrix?: string } }) {
  const session = await requirePagePermission(["collection_points.view", "collection_points.manage"]);
  const canManage = hasPermission(session.user.permissions, "collection_points.manage");
  const q = searchParams.q?.trim();
  const matrix = TEST_MATRIX_VALUES.find((m) => m === searchParams.matrix);

  const points = await prisma.collectionPoint.findMany({
    where: {
      matrix,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    include: { client: { select: { corporateName: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Pontos de Coleta"
        description="Pontos de coleta cadastrados por cliente e matriz."
        actions={canManage && <Link href="/pontos-coleta/novo" className="btn-primary">Novo ponto</Link>}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <SearchInput placeholder="Buscar por nome..." />
        <MatrixFilter current={searchParams.matrix ?? ""} />
      </div>

      <div className="card overflow-x-auto">
        {points.length === 0 ? (
          <EmptyState title="Nenhum ponto de coleta encontrado" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cliente</th>
                <th>Matriz</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-gray-800">{p.name}</td>
                  <td>{p.client.corporateName}</td>
                  <td>{MATRIX_LABELS[p.matrix]}</td>
                  <td>
                    <Badge className={p.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}>
                      {p.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td>
                    <Link href={`/pontos-coleta/${p.id}`} className="text-brand-600 hover:underline text-sm">
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
