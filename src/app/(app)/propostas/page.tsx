import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, MATRIX_LABELS, PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_COLORS } from "@/lib/format";
import { PROPOSAL_STATUS_VALUES } from "@/lib/validations/proposal";
import { StatusFilterClient } from "@/components/proposals/StatusFilterClient";

export default async function PropostasPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const session = await requirePagePermission(["proposals.view", "proposals.manage"]);
  const canManage = hasPermission(session.user.permissions, "proposals.manage");
  const q = searchParams.q?.trim();
  const status = PROPOSAL_STATUS_VALUES.find((s) => s === searchParams.status);

  const proposals = await prisma.proposal.findMany({
    where: {
      supersededAt: null,
      status,
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" as const } },
              { client: { corporateName: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    include: { client: { select: { corporateName: true } }, matrices: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Propostas Comerciais"
        description="Propostas emitidas e seus status."
        actions={canManage && <Link href="/propostas/novo" className="btn-primary">Nova proposta</Link>}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <SearchInput placeholder="Buscar por código ou cliente..." />
        <StatusFilterClient current={searchParams.status ?? ""} />
      </div>

      <div className="card overflow-x-auto">
        {proposals.length === 0 ? (
          <EmptyState title="Nenhuma proposta encontrada" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Matrizes</th>
                <th>Valor total</th>
                <th>Status</th>
                <th>Data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.code}</td>
                  <td className="font-medium text-gray-800">{p.client.corporateName}</td>
                  <td>{p.matrices.map((m) => MATRIX_LABELS[m.matrix]).join(", ")}</td>
                  <td>{formatCurrency(Number(p.totalValue))}</td>
                  <td>
                    <Badge className={PROPOSAL_STATUS_COLORS[p.status]}>{PROPOSAL_STATUS_LABELS[p.status]}</Badge>
                  </td>
                  <td>{formatDate(p.createdAt)}</td>
                  <td>
                    <Link href={`/propostas/${p.id}`} className="text-brand-600 hover:underline text-sm">
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
