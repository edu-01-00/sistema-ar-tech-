import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { ClientForm } from "@/components/clients/ClientForm";
import { ClientContactsPanel } from "@/components/clients/ClientContactsPanel";
import { MATRIX_LABELS } from "@/lib/format";

export default async function ClienteDetailPage({ params }: { params: { id: string } }) {
  const session = await requirePagePermission(["clients.view", "clients.manage"]);
  const canManage = hasPermission(session.user.permissions, "clients.manage");

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { contacts: { orderBy: { name: "asc" } }, collectionPoints: { orderBy: { name: "asc" } } },
  });
  if (!client) notFound();

  return (
    <div>
      <PageHeader
        title={client.corporateName}
        description={client.tradeName ?? undefined}
        actions={
          <>
            <Badge className={client.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}>
              {client.active ? "Ativo" : "Inativo"}
            </Badge>
            {canManage && (
              <ConfirmButton
                url={`/api/clients/${client.id}/deactivate`}
                method="PATCH"
                confirmMessage={client.active ? "Deseja desativar este cliente?" : "Deseja reativar este cliente?"}
                label={client.active ? "Desativar" : "Reativar"}
                className={client.active ? "btn-danger text-xs" : "btn-primary text-xs"}
              />
            )}
          </>
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ClientForm client={client} />
        </div>
        <div className="space-y-6">
          <ClientContactsPanel clientId={client.id} contacts={client.contacts} />

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Pontos de coleta</h2>
              {canManage && (
                <Link href={`/pontos-coleta/novo?clientId=${client.id}`} className="btn-secondary text-xs">
                  Novo ponto
                </Link>
              )}
            </div>
            {client.collectionPoints.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum ponto de coleta cadastrado.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {client.collectionPoints.map((p) => (
                  <li key={p.id} className="py-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">{MATRIX_LABELS[p.matrix]}</p>
                    </div>
                    <Link href={`/pontos-coleta/${p.id}`} className="text-brand-600 hover:underline text-xs">
                      Ver
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
