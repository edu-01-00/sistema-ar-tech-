import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDateTime, MATRIX_LABELS } from "@/lib/format";
import { productiveProcessDetailInclude } from "@/lib/services/productive-process-service";
import { GenerateServiceOrderForm } from "@/components/productive-processes/GenerateServiceOrderForm";

export default async function ProcessoProdutivoDetailPage({ params }: { params: { id: string } }) {
  const session = await requirePagePermission(["productive_processes.view", "productive_processes.manage"]);
  const canManage = hasPermission(session.user.permissions, "productive_processes.manage");

  const productiveProcess = await prisma.productiveProcess.findUnique({
    where: { id: params.id },
    include: productiveProcessDetailInclude,
  });
  if (!productiveProcess) notFound();

  // Parâmetros/ensaios disponíveis para a geração de Ordem de Serviço: os
  // mesmos já vinculados a este ponto de coleta dentro da proposta de
  // origem — nunca uma lista independente (item 5 do requisito).
  const availableTests = await prisma.proposalTest.findMany({
    where: { proposalId: productiveProcess.proposalId, collectionPointId: productiveProcess.collectionPointId },
    include: { test: true },
    orderBy: { nameSnapshot: "asc" },
  });

  return (
    <div>
      <PageHeader
        title={productiveProcess.code}
        description={`Proposta: ${productiveProcess.proposal.code} · Cliente: ${productiveProcess.proposal.client.corporateName} · Ponto de coleta: ${productiveProcess.collectionPoint.name} (${MATRIX_LABELS[productiveProcess.collectionPoint.matrix] ?? productiveProcess.collectionPoint.matrix})`}
        actions={
          <Link href={`/propostas/${productiveProcess.proposalId}`} className="btn-secondary text-xs">
            Ver proposta
          </Link>
        }
      />

      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Rastreabilidade</h2>
        <p className="text-sm text-gray-600">
          Cliente <strong>{productiveProcess.proposal.client.corporateName}</strong> → Proposta{" "}
          <Link href={`/propostas/${productiveProcess.proposalId}`} className="text-brand-600 hover:underline">
            {productiveProcess.proposal.code}
          </Link>{" "}
          → Ponto de coleta <strong>{productiveProcess.collectionPoint.name}</strong> → Processo Produtivo <strong>{productiveProcess.code}</strong>
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Gerado por {productiveProcess.createdBy.name} em {formatDateTime(productiveProcess.createdAt)}.
        </p>
      </div>

      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Ordens de Serviço</h2>
        {productiveProcess.serviceOrders.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma Ordem de Serviço gerada ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {productiveProcess.serviceOrders.map((os) => (
              <li key={os.id} className="py-2 flex items-center justify-between gap-3">
                <div className="text-sm text-gray-800">
                  <span className="font-medium">{os.code}</span>
                  <span className="text-gray-500"> — {os.items.length} parâmetro{os.items.length !== 1 ? "s" : ""} selecionado{os.items.length !== 1 ? "s" : ""}</span>
                </div>
                <Link href={`/ordens-servico/${os.id}`} className="btn-secondary text-xs">
                  Ver detalhes
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage && (
        <GenerateServiceOrderForm
          productiveProcessId={productiveProcess.id}
          availableTests={availableTests.map((t) => ({
            proposalTestId: t.id,
            name: t.nameSnapshot,
            method: t.methodSnapshot,
            unit: t.unitSnapshot,
            code: t.codeSnapshot,
            proposedQuantity: t.quantity,
          }))}
        />
      )}
    </div>
  );
}
