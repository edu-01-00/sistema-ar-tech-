import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { proposalDetailInclude } from "@/lib/services/proposal-service";
import { formatCurrency, formatDateTime, MATRIX_LABELS, PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_COLORS } from "@/lib/format";
import { ProposalStatusActions } from "@/components/proposals/ProposalStatusActions";
import { ReviseButton } from "@/components/proposals/ReviseButton";
import {
  CollectionPointsSection,
  TestsSection,
  CostsSection,
  PaymentSection,
  TextsSection,
  AdditionalInfoSection,
} from "@/components/proposals/ProposalEditableSections";
import type { WizardCollectionPoint } from "@/components/proposals/types";

export default async function PropostaDetailPage({ params }: { params: { id: string } }) {
  const session = await requirePagePermission(["proposals.view", "proposals.manage"]);
  const canManage = hasPermission(session.user.permissions, "proposals.manage");
  const canChangeStatus = hasPermission(session.user.permissions, "proposals.status.change");

  const proposal = await prisma.proposal.findUnique({ where: { id: params.id }, include: proposalDetailInclude });
  if (!proposal) notFound();

  const isEditable = proposal.status === "EM_ELABORACAO" && !proposal.supersededAt;

  const [clientPointsRaw, revisions] = await Promise.all([
    isEditable
      ? prisma.collectionPoint.findMany({
          where: { clientId: proposal.clientId, active: true },
          include: { collectionPointTests: { include: { test: true } } },
        })
      : Promise.resolve([]),
    prisma.proposal.findMany({
      where: { rootId: proposal.rootId },
      select: { id: true, code: true, revision: true, status: true, supersededAt: true },
      orderBy: { revision: "asc" },
    }),
  ]);

  const clientPoints: WizardCollectionPoint[] = clientPointsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    matrix: p.matrix,
    tests: p.collectionPointTests
      .filter((cpt) => cpt.test.active)
      .map((cpt) => ({
        id: cpt.test.id,
        name: cpt.test.name,
        method: cpt.test.method,
        unit: cpt.test.unit,
        parameterCode: cpt.test.parameterCode,
        value: Number(cpt.test.value),
        matrix: cpt.test.matrix,
      })),
  }));

  const matrices = proposal.matrices.map((m) => m.matrix);
  const selectedPointIds = proposal.collectionPoints.map((cp) => cp.collectionPointId);
  const textsMap: Record<string, string> = {};
  for (const t of proposal.texts) textsMap[t.matrix] = t.content;

  return (
    <div>
      <PageHeader
        title={proposal.code}
        description={`Revisão R${String(proposal.revision).padStart(2, "0")} · Cliente: ${proposal.client.corporateName}`}
        actions={
          <>
            <Badge className={PROPOSAL_STATUS_COLORS[proposal.status]}>{PROPOSAL_STATUS_LABELS[proposal.status]}</Badge>
            <a href={`/api/proposals/${proposal.id}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
              Gerar PDF
            </a>
            {canManage && !proposal.supersededAt && <ReviseButton proposalId={proposal.id} />}
            <ProposalStatusActions proposalId={proposal.id} status={proposal.status} canChangeStatus={canChangeStatus} />
          </>
        }
      />

      {revisions.length > 1 && (
        <div className="card p-4 mb-6 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500">Histórico de revisões:</span>
          {revisions.map((r) => (
            <Link
              key={r.id}
              href={`/propostas/${r.id}`}
              className={`text-xs px-2 py-1 rounded-full border ${r.id === proposal.id ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-200"}`}
            >
              R{String(r.revision).padStart(2, "0")} {r.supersededAt ? "(substituída)" : ""}
            </Link>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Dados gerais</h2>
          <p className="text-sm">Matrizes: {matrices.map((m) => MATRIX_LABELS[m]).join(", ")}</p>
          <p className="text-sm">Solicitantes: {proposal.contacts.map((c) => c.clientContact.name).join(", ") || "Nenhum"}</p>
          <p className="text-sm">Criada em: {formatDateTime(proposal.createdAt)}</p>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Totais</h2>
          <p className="text-sm">Ensaios: {formatCurrency(Number(proposal.testsTotal))}</p>
          <p className="text-sm">Deslocamento: {formatCurrency(Number(proposal.travelTotalValue ?? 0))}</p>
          <p className="text-sm">Outros custos: {formatCurrency(Number(proposal.otherCostsTotal))}</p>
          <p className="text-sm font-semibold">Total: {formatCurrency(Number(proposal.totalValue))}</p>
          <p className="text-sm">Pagamento: {proposal.paymentMethod === "PARCELADO" ? `Parcelado em ${proposal.installments}x` : proposal.paymentMethod === "A_VISTA" ? "À vista" : "Não definido"}</p>
        </div>
      </div>

      {isEditable && canManage ? (
        <div className="space-y-6">
          <CollectionPointsSection proposalId={proposal.id} clientPoints={clientPoints} matrices={matrices} initialSelected={selectedPointIds} />
          <TestsSection
            proposalId={proposal.id}
            clientPoints={clientPoints}
            selectedPointIds={selectedPointIds}
            initialTests={proposal.tests.map((t) => ({
              testId: t.testId,
              collectionPointId: t.collectionPointId,
              nameSnapshot: t.nameSnapshot,
              methodSnapshot: t.methodSnapshot,
              unitSnapshot: t.unitSnapshot,
              codeSnapshot: t.codeSnapshot,
              quantity: t.quantity,
              valueSnapshot: Number(t.valueSnapshot),
            }))}
          />
          <CostsSection
            proposalId={proposal.id}
            initialTravel={{
              travelDistanceKm: proposal.travelDistanceKm ? Number(proposal.travelDistanceKm) : null,
              travelValuePerKm: proposal.travelValuePerKm ? Number(proposal.travelValuePerKm) : null,
              travelOtherCosts: proposal.travelOtherCosts ? Number(proposal.travelOtherCosts) : null,
            }}
            initialCosts={proposal.costs.map((c) => ({ description: c.description, value: Number(c.value), type: c.type }))}
          />
          <PaymentSection proposalId={proposal.id} initialPaymentMethod={proposal.paymentMethod} initialInstallments={proposal.installments} />
          <TextsSection proposalId={proposal.id} matrices={matrices} initialTexts={textsMap} />
          <AdditionalInfoSection proposalId={proposal.id} initialValue={proposal.additionalInfo ?? ""} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Ensaios</h2>
            <table className="table-base">
              <thead>
                <tr>
                  <th>Ensaio</th>
                  <th>Código</th>
                  <th>Qtd.</th>
                  <th>Valor unit.</th>
                </tr>
              </thead>
              <tbody>
                {proposal.tests.map((t) => (
                  <tr key={t.id}>
                    <td>{t.nameSnapshot}</td>
                    <td className="font-mono text-xs">{t.codeSnapshot}</td>
                    <td>{t.quantity}</td>
                    <td>{formatCurrency(Number(t.valueSnapshot))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Informações adicionais</h2>
            <p className="text-sm whitespace-pre-wrap">{proposal.additionalInfo || "Nenhuma."}</p>
          </div>
        </div>
      )}

      <div className="card p-5 mt-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Histórico de status</h2>
        <ul className="text-sm space-y-1">
          {proposal.statusHistory.map((h) => (
            <li key={h.id} className="text-gray-600">
              {PROPOSAL_STATUS_LABELS[h.status]} — {formatDateTime(h.createdAt)} por {h.changedBy.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
