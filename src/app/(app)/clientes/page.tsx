import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCnpj, cleanDocumentNumber } from "@/lib/cnpj";

export default async function ClientesPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await requirePagePermission(["clients.view", "clients.manage"]);
  const canManage = hasPermission(session.user.permissions, "clients.manage");
  const q = searchParams.q?.trim();

  const clients = await prisma.client.findMany({
    where: q
      ? {
          OR: [
            { corporateName: { contains: q, mode: "insensitive" as const } },
            { tradeName: { contains: q, mode: "insensitive" as const } },
            { cnpj: { contains: cleanDocumentNumber(q) } },
          ],
        }
      : {},
    orderBy: { corporateName: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Pesquise por CNPJ ou razão social."
        actions={canManage && <Link href="/clientes/novo" className="btn-primary">Novo cliente</Link>}
      />

      <div className="mb-4">
        <SearchInput placeholder="Buscar por CNPJ ou razão social..." />
      </div>

      <div className="card overflow-x-auto">
        {clients.length === 0 ? (
          <EmptyState title="Nenhum cliente encontrado" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Razão social</th>
                <th>Nome fantasia</th>
                <th>CNPJ</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-gray-800">{c.corporateName}</td>
                  <td>{c.tradeName ?? "-"}</td>
                  <td>{formatCnpj(c.cnpj)}</td>
                  <td>
                    <Badge className={c.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}>
                      {c.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td>
                    <Link href={`/clientes/${c.id}`} className="text-brand-600 hover:underline text-sm">
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
