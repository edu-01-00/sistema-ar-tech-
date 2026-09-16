import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { MatrixFilter } from "@/components/tests/MatrixFilter";
import { formatCurrency, MATRIX_LABELS } from "@/lib/format";
import { TEST_MATRIX_VALUES } from "@/lib/validations/test";

export default async function EnsaiosPage({ searchParams }: { searchParams: { q?: string; matrix?: string } }) {
  const session = await requirePagePermission(["tests.view", "tests.manage"]);
  const canManage = hasPermission(session.user.permissions, "tests.manage");
  const q = searchParams.q?.trim();
  const matrix = TEST_MATRIX_VALUES.find((m) => m === searchParams.matrix);

  const tests = await prisma.test.findMany({
    where: {
      matrix,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { parameterCode: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ matrix: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Ensaios"
        description="Catálogo de ensaios organizados por matriz."
        actions={canManage && <Link href="/ensaios/novo" className="btn-primary">Novo ensaio</Link>}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <SearchInput placeholder="Buscar por nome ou código..." />
        <MatrixFilter current={searchParams.matrix ?? ""} />
      </div>

      <div className="card overflow-x-auto">
        {tests.length === 0 ? (
          <EmptyState title="Nenhum ensaio encontrado" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Matriz</th>
                <th>Método</th>
                <th>Unidade</th>
                <th>Valor</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id}>
                  <td className="font-mono text-xs">{t.parameterCode}</td>
                  <td className="font-medium text-gray-800">{t.name}</td>
                  <td>{MATRIX_LABELS[t.matrix]}</td>
                  <td>{t.method}</td>
                  <td>{t.unit}</td>
                  <td>{formatCurrency(Number(t.value))}</td>
                  <td>
                    <Badge className={t.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}>
                      {t.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td>
                    <Link href={`/ensaios/${t.id}`} className="text-brand-600 hover:underline text-sm">
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
