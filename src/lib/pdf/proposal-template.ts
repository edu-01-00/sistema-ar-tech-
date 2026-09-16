import type { Company } from "@prisma/client";
import type { ProposalWithDetails } from "@/lib/services/proposal-service";
import { formatCurrency, formatDate, MATRIX_LABELS } from "@/lib/format";
import { escapeHtml, nl2br } from "@/lib/pdf/html-utils";

export function buildProposalHtml(proposal: ProposalWithDetails, company: Company | null): string {
  const matrixLabels = proposal.matrices.map((m) => MATRIX_LABELS[m.matrix] ?? m.matrix).join(" + ");

  const contactsHtml = proposal.contacts
    .map((c) => `<li>${escapeHtml(c.clientContact.name)}${c.clientContact.role ? ` — ${escapeHtml(c.clientContact.role)}` : ""}</li>`)
    .join("");

  const testsByPoint = new Map<string, typeof proposal.tests>();
  for (const t of proposal.tests) {
    const list = testsByPoint.get(t.collectionPointId) ?? [];
    list.push(t);
    testsByPoint.set(t.collectionPointId, list);
  }

  const pointsHtml = proposal.collectionPoints
    .map(({ collectionPoint }) => {
      const tests = testsByPoint.get(collectionPoint.id) ?? [];
      const rows = tests
        .map(
          (t) => `
        <tr>
          <td>${escapeHtml(t.nameSnapshot)}</td>
          <td>${escapeHtml(t.methodSnapshot)}</td>
          <td>${escapeHtml(t.codeSnapshot)}</td>
          <td>${escapeHtml(t.unitSnapshot)}</td>
          <td class="text-right">${t.quantity}</td>
          <td class="text-right">${formatCurrency(Number(t.valueSnapshot))}</td>
          <td class="text-right">${formatCurrency(Number(t.valueSnapshot) * t.quantity)}</td>
        </tr>`,
        )
        .join("");

      return `
      <h3>Ponto de coleta: ${escapeHtml(collectionPoint.name)} (${MATRIX_LABELS[collectionPoint.matrix] ?? collectionPoint.matrix})</h3>
      <table class="tests-table">
        <thead>
          <tr>
            <th>Ensaio</th><th>Método</th><th>Código</th><th>Unidade</th>
            <th class="text-right">Qtd.</th><th class="text-right">Valor unit.</th><th class="text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7">Nenhum ensaio selecionado.</td></tr>'}</tbody>
      </table>`;
    })
    .join("");

  const costsHtml = proposal.costs
    .map((c) => `<tr><td>${escapeHtml(c.description)}</td><td class="text-right">${formatCurrency(Number(c.value))}</td></tr>`)
    .join("");

  const travelHtml =
    proposal.travelTotalValue && Number(proposal.travelTotalValue) > 0
      ? `<tr><td>Deslocamento (${Number(proposal.travelDistanceKm ?? 0)} km x ${formatCurrency(Number(proposal.travelValuePerKm ?? 0))})</td><td class="text-right">${formatCurrency(Number(proposal.travelTotalValue))}</td></tr>`
      : "";

  const paymentText =
    proposal.paymentMethod === "PARCELADO"
      ? `Parcelado em ${proposal.installments}x`
      : proposal.paymentMethod === "A_VISTA"
        ? "À vista"
        : "Não definida";

  const textsHtml = proposal.texts
    .map((t) => `<section class="tech-text"><h3>${MATRIX_LABELS[t.matrix] ?? t.matrix}</h3><p>${nl2br(t.content)}</p></section>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Proposta ${escapeHtml(proposal.code)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #1d4ed8; }
  h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 2px solid #1d4ed8; padding-bottom: 4px; }
  h3 { font-size: 12px; margin: 12px 0 4px; }
  header.doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1d4ed8; padding-bottom: 10px; margin-bottom: 14px; }
  .doc-meta { text-align: right; font-size: 11px; }
  .doc-meta div { margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { border: 1px solid #d1d5db; padding: 5px 7px; font-size: 10.5px; }
  th { background: #f3f4f6; text-align: left; }
  .text-right { text-align: right; }
  .totals-table td:first-child { font-weight: bold; }
  .grand-total { font-size: 13px; font-weight: bold; background: #eff6ff; }
  .info-grid { display: flex; gap: 24px; margin-bottom: 10px; }
  .info-grid > div { flex: 1; }
  .tech-text p { text-align: justify; line-height: 1.5; }
  .signature-area { margin-top: 40px; display: flex; justify-content: space-between; }
  .signature-line { border-top: 1px solid #333; width: 260px; text-align: center; padding-top: 4px; font-size: 10px; }
  footer { margin-top: 20px; font-size: 9px; color: #666; text-align: center; }
</style>
</head>
<body>
  <header class="doc-header">
    <div>
      <h1>${escapeHtml(company?.name ?? "Laboratório")}</h1>
      ${company?.cnpj ? `<div>CNPJ: ${escapeHtml(company.cnpj)}</div>` : ""}
      ${company?.email ? `<div>${escapeHtml(company.email)}</div>` : ""}
    </div>
    <div class="doc-meta">
      <div><strong>Proposta:</strong> ${escapeHtml(proposal.code)}</div>
      <div><strong>Revisão:</strong> R${String(proposal.revision).padStart(2, "0")}</div>
      <div><strong>Data:</strong> ${formatDate(proposal.createdAt)}</div>
      <div><strong>Status:</strong> ${escapeHtml(proposal.status)}</div>
    </div>
  </header>

  <h2>Dados do Cliente</h2>
  <div class="info-grid">
    <div>
      <div><strong>Razão social:</strong> ${escapeHtml(proposal.client.corporateName)}</div>
      <div><strong>CNPJ:</strong> ${escapeHtml(proposal.client.cnpj)}</div>
      ${proposal.client.email ? `<div><strong>E-mail:</strong> ${escapeHtml(proposal.client.email)}</div>` : ""}
    </div>
    <div>
      <strong>Solicitante(s):</strong>
      <ul>${contactsHtml || "<li>Não informado</li>"}</ul>
    </div>
  </div>

  <h2>Matrizes Contempladas</h2>
  <p>${escapeHtml(matrixLabels)}</p>

  <h2>Pontos de Coleta e Ensaios</h2>
  ${pointsHtml || "<p>Nenhum ponto de coleta selecionado.</p>"}

  <h2>Custos</h2>
  <table class="totals-table">
    <tbody>
      ${travelHtml}
      ${costsHtml}
      <tr><td>Total de ensaios</td><td class="text-right">${formatCurrency(Number(proposal.testsTotal))}</td></tr>
      <tr class="grand-total"><td>Valor total da proposta</td><td class="text-right">${formatCurrency(Number(proposal.totalValue))}</td></tr>
    </tbody>
  </table>

  <h2>Forma de Pagamento</h2>
  <p>${escapeHtml(paymentText)}</p>

  <h2>Textos Técnicos</h2>
  ${textsHtml || "<p>Nenhum texto técnico associado.</p>"}

  <h2>Informações Adicionais</h2>
  <p>${nl2br(proposal.additionalInfo) || "Nenhuma informação adicional."}</p>

  <div class="signature-area">
    <div class="signature-line">${escapeHtml(company?.name ?? "Laboratório")}</div>
    <div class="signature-line">${escapeHtml(proposal.client.corporateName)} (Aceite do cliente)</div>
  </div>

  <footer>Documento gerado automaticamente pelo sistema de gestão do laboratório em ${formatDate(new Date())}.</footer>
</body>
</html>`;
}
