import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDateTime, MATRIX_LABELS } from "@/lib/format";

export default async function OrdemServicoDetailPage({ params }: { params: { id: string } }) {
  await requirePagePermission(["productive_processes.view", "productive_processes.manage"]);

  const serviceOrder = await prisma.serviceOrder.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { id: true, name: true } },
      items: { include: { proposalTest: { include: { test: true } } } },
      productiveProcess: {
        include: {
          collectionPoint: true,
          proposal: { include: { client: true } },
        },
      },
    },
  });
  if (!serviceOrder) notFound();

  const pp = serviceOrder.productiveProcess;

  return (
    <div>
      <PageHeader
        title={serviceOrder.code}
        description={`Processo Produtivo: ${pp.code} · Ponto de coleta: ${pp.collectionPoint.name} (${MATRIX_LABELS[pp.collectionPoint.matrix] ?? pp.collectionPoint.matrix})`}
        actions={
          <Link href={`/processos-produtivos/${pp.id}`} className="btn-secondary text-xs">
            Ver Processo Produtivo
          </Link>
        }
      />

      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Rastreabilidade</h2>
        <p className="text-sm text-gray-600">
          Cliente <strong>{pp.proposal.client.corporateName}</strong> → Proposta{" "}
          <Link href={`/propostas/${pp.proposalId}`} className="text-brand-600 hover:underline">
            {pp.proposal.code}
          </Link>{" "}
          → Ponto de coleta <strong>{pp.collectionPoint.name}</strong> → Processo Produtivo{" "}
          <Link href={`/processos-produtivos/${pp.id}`} className="text-brand-600 hover:underline">
            {pp.code}
          </Link>{" "}
          → Ordem de Serviço <strong>{serviceOrder.code}</strong>
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Gerada por {serviceOrder.createdBy.name} em {formatDateTime(serviceOrder.createdAt)}.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Parâmetros selecionados</h2>
        <table className="table-base">
          <thead>
            <tr>
              <th>Ensaio</th>
              <th>Método</th>
              <th>Unidade</th>
              <th>Código</th>
              <th>Qtd. a realizar</th>
            </tr>
          </thead>
          <tbody>
            {serviceOrder.items.map((item) => (
              <tr key={item.id}>
                <td>{item.proposalTest.nameSnapshot}</td>
                <td>{item.proposalTest.methodSnapshot}</td>
                <td>{item.proposalTest.unitSnapshot}</td>
                <td className="font-mono text-xs">{item.proposalTest.codeSnapshot}</td>
                <td>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
