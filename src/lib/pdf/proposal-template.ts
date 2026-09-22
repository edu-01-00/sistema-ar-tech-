import type { Company } from "@prisma/client";
import type { ProposalWithDetails } from "@/lib/services/proposal-service";
import { formatCurrency, formatDate, MATRIX_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_TERM_LABELS } from "@/lib/format";
import { escapeHtml, nl2br } from "@/lib/pdf/html-utils";

type TextSnapshot = ProposalWithDetails["textSnapshots"][number];

function getSnapshot(snapshots: TextSnapshot[], category: string, matrix: string | null = null): TextSnapshot | undefined {
  return snapshots.find((s) => s.category === category && s.matrix === matrix);
}

export function buildProposalHtml(proposal: ProposalWithDetails, company: Company | null, logoDataUri?: string | null): string {
  const contactsHtml = proposal.contacts
    .map((c) => `<li>${escapeHtml(c.clientContact.name)}${c.clientContact.role ? ` — ${escapeHtml(c.clientContact.role)}` : ""}</li>`)
    .join("");

  const testsByPoint = new Map<string, typeof proposal.tests>();
  for (const t of proposal.tests) {
    const list = testsByPoint.get(t.collectionPointId) ?? [];
    list.push(t);
    testsByPoint.set(t.collectionPointId, list);
  }

  // Item 13-14: tabela de serviços — sem "código do parâmetro", com LQ +
  // unidade (do cadastro do ensaio) e coluna Acreditado/CGCRE (também do
  // cadastro do ensaio, nunca definida manualmente na proposta). O valor
  // unitário só aparece se exhibitUnitValue estiver ativo (item 15) — o
  // total, porém, é sempre calculado com os valores reais.
  const showUnitValue = proposal.exhibitUnitValue;
  const pointsHtml = proposal.collectionPoints
    .map(({ collectionPoint }) => {
      const tests = testsByPoint.get(collectionPoint.id) ?? [];
      const rows = tests
        .map((t) => {
          const lq = t.test.quantificationLimit ? `${escapeHtml(t.test.quantificationLimit)}` : "-";
          const acreditado = t.test.isAccredited ? "CGCRE" : "-";
          return `
        <tr>
          <td>${escapeHtml(t.nameSnapshot)}</td>
          <td>${escapeHtml(t.methodSnapshot)}</td>
          <td>${lq}</td>
          <td>${escapeHtml(t.test.unit)}</td>
          <td class="text-center">${acreditado}</td>
          <td class="text-right">${t.quantity}</td>
          ${showUnitValue ? `<td class="text-right">${formatCurrency(Number(t.valueSnapshot))}</td><td class="text-right">${formatCurrency(Number(t.valueSnapshot) * t.quantity)}</td>` : ""}
        </tr>`;
        })
        .join("");

      return `
      <h3>Ponto de coleta: ${escapeHtml(collectionPoint.name)} (${MATRIX_LABELS[collectionPoint.matrix] ?? collectionPoint.matrix})</h3>
      <table class="tests-table">
        <thead>
          <tr>
            <th>Ensaio</th><th>Método</th><th>LQ</th><th>Unidade</th><th class="text-center">Acreditado</th>
            <th class="text-right">Qtd.</th>
            ${showUnitValue ? '<th class="text-right">Valor unit.</th><th class="text-right">Subtotal</th>' : ""}
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="${showUnitValue ? 8 : 6}">Nenhum ensaio selecionado.</td></tr>`}</tbody>
      </table>`;
    })
    .join("");

  // Item 16: seção de custos só aparece se useAdditionalCosts estiver ativo.
  // O total já reflete essa opção (calculado em recalculateProposalTotals);
  // aqui apenas decidimos o que exibir.
  const costsHtml = proposal.costs
    .map((c) => `<tr><td>${escapeHtml(c.description)}</td><td class="text-right">${formatCurrency(Number(c.value))}</td></tr>`)
    .join("");
  const travelHtml =
    proposal.travelTotalValue && Number(proposal.travelTotalValue) > 0
      ? `<tr><td>Deslocamento (${Number(proposal.travelDistanceKm ?? 0)} km x ${formatCurrency(Number(proposal.travelValuePerKm ?? 0))})</td><td class="text-right">${formatCurrency(Number(proposal.travelTotalValue))}</td></tr>`
      : "";

  const custosSectionHtml = proposal.useAdditionalCosts
    ? `
    <h2>Custos</h2>
    <table class="totals-table">
      <tbody>
        ${travelHtml}
        ${costsHtml}
        <tr><td>Total de ensaios</td><td class="text-right">${formatCurrency(Number(proposal.testsTotal))}</td></tr>
        <tr class="grand-total"><td>Valor total da proposta</td><td class="text-right">${formatCurrency(Number(proposal.totalValue))}</td></tr>
      </tbody>
    </table>`
    : `
    <h2>Custos</h2>
    <table class="totals-table">
      <tbody>
        <tr><td>Total de ensaios</td><td class="text-right">${formatCurrency(Number(proposal.testsTotal))}</td></tr>
        <tr class="grand-total"><td>Valor total da proposta</td><td class="text-right">${formatCurrency(Number(proposal.totalValue))}</td></tr>
      </tbody>
    </table>`;

  // Item 17-19: forma de pagamento + textos automáticos por condição +
  // dados bancários automáticos quando Depósito/PIX.
  const paymentMethodLabel = proposal.paymentMethod ? PAYMENT_METHOD_LABELS[proposal.paymentMethod] : "Não definida";
  const paymentTermLabel = proposal.paymentTerm ? PAYMENT_TERM_LABELS[proposal.paymentTerm] : null;
  const paymentConditionText =
    proposal.paymentTerm === "DIAS_30"
      ? getSnapshot(proposal.textSnapshots, "FORMA_PAGAMENTO_30")?.content
      : proposal.paymentTerm === "DIAS_15_30"
        ? getSnapshot(proposal.textSnapshots, "FORMA_PAGAMENTO_15_30")?.content
        : null;

  const bankDataHtml =
    proposal.paymentMethod === "DEPOSITO_PIX"
      ? `<div class="bank-data">
          <strong>Dados bancários:</strong>
          <ul>
            ${company?.bankName ? `<li>Banco: ${escapeHtml(company.bankName)}</li>` : ""}
            ${company?.bankAgency ? `<li>Agência: ${escapeHtml(company.bankAgency)}</li>` : ""}
            ${company?.bankAccount ? `<li>Conta: ${escapeHtml(company.bankAccount)}${company.bankAccountType ? ` (${escapeHtml(company.bankAccountType)})` : ""}</li>` : ""}
            ${company?.bankPixKey ? `<li>Chave PIX: ${escapeHtml(company.bankPixKey)}</li>` : ""}
          </ul>
        </div>`
      : "";

  const paymentHtml = `
    <h2>Forma de Pagamento</h2>
    <p><strong>${escapeHtml(paymentMethodLabel)}</strong>${proposal.paymentMethod === "PARCELADO" ? ` — ${proposal.installments}x` : ""}${paymentTermLabel ? ` — Vencimento: ${escapeHtml(paymentTermLabel)}` : ""}</p>
    ${paymentConditionText ? `<p>${nl2br(paymentConditionText)}</p>` : ""}
    ${bankDataHtml}`;

  // Item 20: serviços realizados por provedor externo (subcontratados),
  // derivados automaticamente do cadastro do ensaio — nunca preenchido
  // manualmente na proposta.
  const subcontractedTests = [...new Map(proposal.tests.filter((t) => t.test.isSubcontracted).map((t) => [t.testId, t])).values()];
  const externalProviderHtml =
    subcontractedTests.length > 0
      ? `<ul>${subcontractedTests.map((t) => `<li>${escapeHtml(t.test.name)}</li>`).join("")}</ul>`
      : "<p>NÃO APLICÁVEL</p>";

  // Item 21-23, 29-31: textos padrão (snapshot no momento da criação da
  // proposta — editar o texto padrão depois nunca altera propostas emitidas).
  const declaracaoConformidade = getSnapshot(proposal.textSnapshots, "DECLARACAO_CONFORMIDADE")?.content;
  const validadeProposta = getSnapshot(proposal.textSnapshots, "VALIDADE_PROPOSTA")?.content;
  const prazoEntregaRelatorio = getSnapshot(proposal.textSnapshots, "PRAZO_ENTREGA_RELATORIO")?.content;
  const protecaoPropriedadeCliente = getSnapshot(proposal.textSnapshots, "PROTECAO_PROPRIEDADE_CLIENTE")?.content;
  const confirmacaoProposta = getSnapshot(proposal.textSnapshots, "CONFIRMACAO_PROPOSTA")?.content;
  const outrasInformacoes = getSnapshot(proposal.textSnapshots, "OUTRAS_INFORMACOES")?.content;

  // Item 24-28: blocos de observações importantes selecionados na proposta.
  const observationBlocks: { matrix: string; selected: boolean }[] = [
    { matrix: "EMISSOES_ATMOSFERICAS", selected: proposal.observationEmissoesAtmosfericas },
    { matrix: "QUALIDADE_AR", selected: proposal.observationQualidadeAr },
    { matrix: "RUIDO_AMBIENTAL", selected: proposal.observationRuido },
  ];
  const observacoesImportantesHtml = observationBlocks
    .filter((b) => b.selected)
    .map((b) => {
      const snapshot = getSnapshot(proposal.textSnapshots, "OBSERVACAO_IMPORTANTE", b.matrix);
      if (!snapshot) return "";
      return `<section class="obs-block"><h3>${escapeHtml(snapshot.name)}</h3><p>${nl2br(snapshot.content)}</p></section>`;
    })
    .join("");

  const textsHtml = proposal.texts
    .map((t) => `<section class="tech-text"><h3>${MATRIX_LABELS[t.matrix] ?? t.matrix}</h3><p>${nl2br(t.content)}</p></section>`)
    .join("");

  // Item 32: checklist de análise crítica — texto fixo (não administrável),
  // conforme fornecido. Os itens aparecem marcados quando a análise crítica
  // da proposta foi confirmada (item 33 registra quem e quando).
  const checkMark = proposal.criticalAnalysisConfirmed ? "[x]" : "[ ]";
  const criticalAnalysisItems = [
    "Os requisitos do cliente estão definidos, documentados e entendidos;",
    "O laboratório tem capacidade e recursos para atender aos requisitos;",
    "Foram selecionados métodos ou procedimentos apropriados e capazes de atender aos requisitos do cliente;",
    "Quando forem utilizados, os serviços providos externamente estão informados na proposta, e estão devidamente qualificados conforme o item 6.6 da norma ISO/IEC 17025:2017.",
  ];
  const criticalAnalysisHtml = `
    <h2>Análise Crítica/Confirmação</h2>
    <p>Eu Ricardo Donato ao realizar a análise crítica deste contrato garanto que foram verificados os seguintes aspectos:</p>
    <ul class="checklist">
      ${criticalAnalysisItems.map((item) => `<li>${checkMark} ${escapeHtml(item)}</li>`).join("")}
    </ul>`;

  // Item 33-34: responsáveis e data — sempre extraídos dos dados já
  // existentes (usuário logado, empresa), nunca digitados novamente.
  const responsaveisHtml = `
    <h2>Responsáveis pela Proposta</h2>
    <p><strong>ELABORADO POR:</strong> ${escapeHtml(proposal.createdBy.name)}</p>
    <p><strong>ANALISADO CRITICAMENTE POR:</strong> ${proposal.criticalAnalysisBy ? escapeHtml(proposal.criticalAnalysisBy.name) : "Pendente"}</p>
    <p><strong>Data:</strong> ${escapeHtml(company?.addressCity ?? "")}${company?.addressCity ? " / " : ""}${formatDate(proposal.createdAt)}</p>`;

  const companyAddressParts = [
    [company?.addressStreet, company?.addressNumber].filter(Boolean).join(", "),
    company?.addressComplement,
    company?.addressDistrict,
    [company?.addressCity, company?.addressState].filter(Boolean).join("/"),
    company?.addressZipCode ? `CEP ${company.addressZipCode}` : null,
  ].filter(Boolean);
  const companyAddressHtml = companyAddressParts.length > 0 ? `<div>${escapeHtml(companyAddressParts.join(" - "))}</div>` : "";

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
  header.doc-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 3px solid #1d4ed8; padding-bottom: 10px; margin-bottom: 14px; }
  header.doc-header .brand { display: flex; align-items: center; gap: 12px; }
  header.doc-header img.logo { max-height: 60px; max-width: 170px; object-fit: contain; }
  .doc-meta { text-align: right; font-size: 11px; }
  .doc-meta div { margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { border: 1px solid #d1d5db; padding: 5px 7px; font-size: 10.5px; }
  th { background: #f3f4f6; text-align: left; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .totals-table td:first-child { font-weight: bold; }
  .grand-total { font-size: 13px; font-weight: bold; background: #eff6ff; }
  .info-grid { display: flex; gap: 24px; margin-bottom: 10px; }
  .info-grid > div { flex: 1; }
  .tech-text p, .obs-block p { text-align: justify; line-height: 1.5; }
  .bank-data { margin-top: 6px; }
  .bank-data ul { margin: 4px 0 0; padding-left: 18px; }
  .checklist { list-style: none; padding-left: 0; line-height: 1.7; }
  .signature-area { margin-top: 40px; display: flex; justify-content: space-between; }
  .signature-line { border-top: 1px solid #333; width: 260px; text-align: center; padding-top: 4px; font-size: 10px; }
  footer { margin-top: 20px; font-size: 9px; color: #666; text-align: center; }
</style>
</head>
<body>
  <header class="doc-header">
    <div class="brand">
      ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="Logomarca" />` : ""}
      <div>
        <h1>${escapeHtml(company?.name ?? "Laboratório")}</h1>
        ${company?.cnpj ? `<div>CNPJ: ${escapeHtml(company.cnpj)}</div>` : ""}
        ${company?.email ? `<div>${escapeHtml(company.email)}</div>` : ""}
        ${companyAddressHtml}
      </div>
    </div>
    <div class="doc-meta">
      <div><strong>Proposta:</strong> ${escapeHtml(proposal.code)}</div>
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

  <h2>Serviços Solicitados</h2>
  ${pointsHtml || "<p>Nenhum ponto de coleta selecionado.</p>"}

  ${custosSectionHtml}

  ${paymentHtml}

  <h2>Serviços a Serem Realizados por Provedor Externo</h2>
  ${externalProviderHtml}

  ${declaracaoConformidade ? `<h2>Declaração da Conformidade e Regra de Decisão</h2><p>${nl2br(declaracaoConformidade)}</p>` : ""}

  ${validadeProposta ? `<h2>Validade da Proposta</h2><p>${nl2br(validadeProposta)}</p>` : ""}

  ${prazoEntregaRelatorio ? `<h2>Prazo de Entrega do Relatório</h2><p>${nl2br(prazoEntregaRelatorio)}</p>` : ""}

  ${observacoesImportantesHtml ? `<h2>Observações Importantes</h2>${observacoesImportantesHtml}` : ""}

  <h2>Textos Técnicos</h2>
  ${textsHtml || "<p>Nenhum texto técnico associado.</p>"}

  <h2>Informações Adicionais</h2>
  <p>${nl2br(proposal.additionalInfo) || "Nenhuma informação adicional."}</p>

  ${protecaoPropriedadeCliente ? `<h2>Proteção da Propriedade do Cliente</h2><p>${nl2br(protecaoPropriedadeCliente)}</p>` : ""}

  ${confirmacaoProposta ? `<h2>Confirmação da Proposta / Dúvidas</h2><p>${nl2br(confirmacaoProposta)}</p>` : ""}

  ${outrasInformacoes ? `<h2>Outras Informações</h2><p>${nl2br(outrasInformacoes)}</p>` : ""}

  ${criticalAnalysisHtml}

  ${responsaveisHtml}

  <div class="signature-area">
    <div class="signature-line">${escapeHtml(company?.name ?? "Laboratório")}</div>
    <div class="signature-line">${escapeHtml(proposal.client.corporateName)} (Aceite do cliente)</div>
  </div>

  <footer>Documento gerado automaticamente pelo sistema de gestão do laboratório em ${formatDate(new Date())}.</footer>
</body>
</html>`;
}
