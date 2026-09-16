import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

export default async function LegislacaoPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await requirePagePermission(["legislations.view", "legislations.manage"]);
  const canManage = hasPermission(session.user.permissions, "legislations.manage");
  const q = searchParams.q?.trim();

  const legislations = await prisma.legislation.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { item: { contains: q, mode: "insensitive" as const } }] }
      : {},
    include: { legislationTests: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Legislação"
        description="Cadastro de legislações e vínculo com ensaios."
        actions={canManage && <Link href="/legislacao/novo" className="btn-primary">Nova legislação</Link>}
      />

      <div className="mb-4">
        <SearchInput placeholder="Buscar por nome ou item..." />
      </div>

      <div className="card overflow-x-auto">
        {legislations.length === 0 ? (
          <EmptyState title="Nenhuma legislação cadastrada" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Item</th>
                <th>Ensaios vinculados</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {legislations.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium text-gray-800">{l.name}</td>
                  <td>{l.item ?? "-"}</td>
                  <td>{l.legislationTests.length}</td>
                  <td>
                    <Badge className={l.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}>
                      {l.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td>
                    <Link href={`/legislacao/${l.id}`} className="text-brand-600 hover:underline text-sm">
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
