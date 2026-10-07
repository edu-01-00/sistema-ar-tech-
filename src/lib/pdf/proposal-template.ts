import type { Company } from "@prisma/client";
import type { ProposalWithDetails } from "@/lib/services/proposal-service";
import { formatCurrency, formatDate, MATRIX_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { escapeHtml, nl2br } from "@/lib/pdf/html-utils";
import { BRAZILIAN_STATES } from "@/lib/br-locations";
import { formatCnpj } from "@/lib/cnpj";
import { buildPaymentConditionText, computePointDisplaySubtotals, sumDisplaySubtotals, round2 } from "@/lib/proposal-logic";

type TextSnapshot = ProposalWithDetails["textSnapshots"][number];

function getSnapshot(snapshots: TextSnapshot[], category: string, matrix: string | null = null): TextSnapshot | undefined {
  return snapshots.find((s) => s.category === category && s.matrix === matrix);
}

function stateFullName(uf: string | null | undefined): string {
  if (!uf) return "";
  return BRAZILIAN_STATES.find((s) => s.uf === uf)?.name ?? uf;
}

// Destaca em negrito termos específicos do texto de Declaração de
// Conformidade, sem alterar o conteúdo original (aplicado só na renderização).
function boldTerms(html: string): string {
  return html.replace(/• Risco Associado:/g, "<strong>• Risco Associado:</strong>").replace(/NÃO/g, "<strong>NÃO</strong>");
}

// Rodapé do PDF via footerTemplate do Puppeteer (fora do fluxo do <body>):
// paginação à esquerda, "Emitente: CQ" + código do modelo ao centro, e um
// espaço reservado à direita para o código do formulário — que só poderá ser
// preenchido quando a lista mestra de documentos existir no sistema (não há
// essa informação disponível ainda, então o campo fica em branco).
export function buildProposalFooterTemplate(): string {
  return `
  <div style="width:100%; font-size:8px; color:#666; padding:0 14mm; margin:0; display:flex; justify-content:space-between; align-items:flex-start; font-family: Arial, Helvetica, sans-serif; box-sizing:border-box;">
    <div>Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>
    <div style="text-align:center;">
      <div>Emitente: CQ</div>
      <div style="font-size:6.5px;">MOD-01Rev01</div>
    </div>
    <div style="text-align:right;">&nbsp;</div>
  </div>`;
}

export function buildProposalHtml(proposal: ProposalWithDetails, company: Company | null, logoDataUri?: string | null): string {
  // Item "Dados do Cliente": bloco no formato de tabela com rótulos fixos
  // (Razão Social, CNPJ/CEP, Endereço, Contato, Fone, E-mail).
  const client = proposal.client;
  const clientAddressLine = [
    [client.addressStreet, client.addressNumber].filter(Boolean).join(", "),
    client.addressDistrict,
    [client.addressCity, stateFullName(client.addressState)].filter(Boolean).join(" / "),
  ]
    .filter(Boolean)
    .join(" - ");
  const clientContactNames =
    proposal.contacts.length > 0
      ? proposal.contacts.map((c) => escapeHtml(c.clientContact.name)).join(", ")
      : escapeHtml(client.corporateName);

  const clientDataBoxHtml = `
    <div class="data-box">
      <div class="box-title">Dados do Cliente</div>
      <table class="box-table">
        <tr><td class="label">Razão Social:</td><td colspan="3">${escapeHtml(client.corporateName)}</td></tr>
        <tr>
          <td class="label">CNPJ:</td><td>${escapeHtml(formatCnpj(client.cnpj))}</td>
          <td class="label">CEP:</td><td>${escapeHtml(client.addressZipCode ?? "")}</td>
        </tr>
        <tr><td class="label">Endereço:</td><td colspan="3">${escapeHtml(clientAddressLine) || "Não informado"}</td></tr>
        <tr><td class="label">Contato:</td><td colspan="3">${clientContactNames}</td></tr>
        <tr>
          <td class="label">Fone:</td><td>${escapeHtml(client.phone ?? "")}</td>
          <td class="label">E-mail:</td><td>${client.email ? escapeHtml(client.email) : ""}</td>
        </tr>
      </table>
    </div>`;

  const testsByPoint = new Map<string, typeof proposal.tests>();
  for (const t of proposal.tests) {
    const list = testsByPoint.get(t.collectionPointId) ?? [];
    list.push(t);
    testsByPoint.set(t.collectionPointId, list);
  }

  // Rateio do custo adicional: calculado no nível do ENSAIO (cada linha de
  // ProposalTest), proporcional ao valor de cada ensaio (quantidade × valor
  // unitário) em relação ao total de ensaios da proposta — nunca dividido
  // igualmente nem por ponto. Quando "demonstrar custo adicional" = Não, o
  // valor de cada ensaio exibido já incorpora sua parte proporcional do
  // custo adicional; quando = Sim, o valor exibido é o original (o custo
  // aparece como linha separada). A soma dos valores rateados é sempre
  // exatamente igual ao custo adicional total (computePointDisplaySubtotals
  // é a mesma função genérica de distribuição usada em todo o sistema —
  // aqui aplicada por ensaio, não por ponto).
  const testLineSubtotals = computePointDisplaySubtotals({
    points: proposal.tests.map((t) => ({ key: t.id, testsSubtotal: Number(t.valueSnapshot) * t.quantity })),
    otherCostsTotal: Number(proposal.otherCostsTotal),
    distributeOtherCosts: !proposal.useAdditionalCosts,
  });
  const testLineDisplayById = new Map(testLineSubtotals.map((s) => [s.key, s.displaySubtotal]));

  // Item 13-14: tabela de serviços — sem "código do parâmetro", com LQ +
  // unidade (do cadastro do ensaio) e coluna Acreditado/CGCRE (também do
  // cadastro do ensaio, nunca definida manualmente na proposta). O valor
  // unitário só aparece se exhibitUnitValue estiver ativo (item 15) — o
  // "Subtotal" exibido de cada ensaio já reflete o rateio do custo adicional
  // quando aplicável (o "Valor unit." permanece o valor contratado, sem
  // alteração — só o total da linha incorpora o rateio).
  const showUnitValue = proposal.exhibitUnitValue;
  const pointsHtml = proposal.collectionPoints
    .map(({ collectionPoint }) => {
      const tests = testsByPoint.get(collectionPoint.id) ?? [];
      const rows = tests
        .map((t) => {
          const lq = t.test.quantificationLimit ? `${escapeHtml(t.test.quantificationLimit)}` : "-";
          const acreditado = t.test.isAccredited ? "CGCRE" : "-";
          const lineSubtotal = testLineDisplayById.get(t.id) ?? Number(t.valueSnapshot) * t.quantity;
          return `
        <tr>
          <td>${escapeHtml(t.nameSnapshot)}</td>
          <td>${escapeHtml(t.methodSnapshot)}</td>
          <td>${lq}</td>
          <td>${escapeHtml(t.test.unit)}</td>
          <td class="text-center">${acreditado}</td>
          <td class="text-center">${t.quantity}</td>
          ${showUnitValue ? `<td class="text-right">${formatCurrency(Number(t.valueSnapshot))}</td><td class="text-right">${formatCurrency(lineSubtotal)}</td>` : ""}
        </tr>`;
        })
        .join("");

      return `
      <h3>Ponto de coleta: ${escapeHtml(collectionPoint.name)} (${MATRIX_LABELS[collectionPoint.matrix] ?? collectionPoint.matrix})</h3>
      <table class="tests-table">
        <thead>
          <tr>
            <th>Ensaio</th><th>Método</th><th>LQ</th><th>Unidade</th><th class="text-center">Acreditado</th>
            <th class="text-center">Qtd.</th>
            ${showUnitValue ? '<th class="text-right">Valor unit.</th><th class="text-right">Subtotal</th>' : ""}
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="${showUnitValue ? 8 : 6}">Nenhum ensaio selecionado.</td></tr>`}</tbody>
      </table>`;
    })
    .join("");

  // RESUMO COMERCIAL (antes "Custos"): mostra o valor total de cada ponto de
  // coleta, seguido (se demonstrados) dos outros custos, depois o somatório
  // total dos ensaios, o deslocamento (rótulo simples, sem o cálculo entre
  // parênteses — exibido apenas se exhibitTravelValue estiver ativo, mas
  // sempre somado ao valor final, exibido ou não), o desconto (se houver) e
  // por fim o valor total. O total de cada ponto é a soma dos valores já
  // rateados (por ensaio) dos seus próprios ensaios — nunca uma segunda
  // distribuição — garantindo que a soma bata exatamente com o rateio.
  const pointSubtotalsHtml = proposal.collectionPoints
    .map(({ collectionPoint }) => {
      const tests = testsByPoint.get(collectionPoint.id) ?? [];
      const pointDisplayTotal = round2(tests.reduce((sum, t) => sum + (testLineDisplayById.get(t.id) ?? 0), 0));
      return `<tr><td>Valor total — ${escapeHtml(collectionPoint.name)}</td><td class="text-right">${formatCurrency(pointDisplayTotal)}</td></tr>`;
    })
    .join("");
  const ensaiosDisplayTotal = sumDisplaySubtotals(testLineSubtotals);

  const costsHtml = proposal.costs
    .map((c) => `<tr><td>${escapeHtml(c.description)}</td><td class="text-right">${formatCurrency(Number(c.value))}</td></tr>`)
    .join("");

  const travelHtml =
    proposal.exhibitTravelValue && proposal.travelTotalValue && Number(proposal.travelTotalValue) > 0
      ? `<tr><td>Deslocamento</td><td class="text-right">${formatCurrency(Number(proposal.travelTotalValue))}</td></tr>`
      : "";

  const discountHtml =
    Number(proposal.discountValue) > 0
      ? `<tr><td>Valor total de descontos ${Number(proposal.discountPercent)}%</td><td class="text-right">${formatCurrency(Number(proposal.discountValue))}</td></tr>`
      : "";

  const custosSectionHtml = `
    <h2>RESUMO COMERCIAL</h2>
    <table class="totals-table">
      <tbody>
        ${pointSubtotalsHtml}
        ${proposal.useAdditionalCosts ? costsHtml : ""}
        <tr><td>Total de ensaios</td><td class="text-right">${formatCurrency(ensaiosDisplayTotal)}</td></tr>
        ${travelHtml}
        ${discountHtml}
        <tr class="grand-total"><td>Valor total da proposta</td><td class="text-right">${formatCurrency(Number(proposal.totalValue))}</td></tr>
      </tbody>
    </table>`;

  // Item 17-19: forma de pagamento + texto automático gerado dinamicamente a
  // partir dos dias de vencimento informados + dados bancários automáticos
  // quando Depósito/PIX.
  const paymentMethodLabel = proposal.paymentMethod ? PAYMENT_METHOD_LABELS[proposal.paymentMethod] : "Não definida";
  const paymentConditionText = buildPaymentConditionText({
    paymentMethod: proposal.paymentMethod,
    paymentDueDays: proposal.paymentDueDays,
    installments: proposal.installments,
    firstInstallmentDueDays: proposal.firstInstallmentDueDays,
  });

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
    <p><strong>${escapeHtml(paymentMethodLabel)}</strong>${proposal.paymentMethod === "PARCELADO" ? ` — ${proposal.installments}x` : ""}</p>
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

  // "Outras Informações" foi renomeada para "Informações Adicionais" e passou
  // a incluir também o texto livre da proposta (antes era uma seção à parte).
  const informacoesAdicionaisParts = [
    outrasInformacoes ? nl2br(outrasInformacoes) : "",
    proposal.additionalInfo ? nl2br(proposal.additionalInfo) : "",
  ].filter(Boolean);
  const informacoesAdicionaisHtml =
    informacoesAdicionaisParts.length > 0
      ? `<h2>Informações Adicionais</h2>${informacoesAdicionaisParts.map((p) => `<p>${p}</p>`).join("")}`
      : "";

  // A análise crítica (4 itens verificados internamente) não aparece no PDF
  // da proposta — é uso interno, apenas na fase final de elaboração.

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
  h1 { font-size: 16px; margin: 0 0 4px; color: #1d4ed8; }
  h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 2px solid #1d4ed8; padding-bottom: 4px; }
  h3 { font-size: 12px; margin: 12px 0 4px; }
  header.doc-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 3px solid #1d4ed8; padding-bottom: 10px; margin-bottom: 14px; }
  header.doc-header .brand { display: flex; align-items: center; gap: 12px; }
  header.doc-header img.logo { max-height: 60px; max-width: 170px; object-fit: contain; }
  header.doc-header .company-info { font-size: 9.5px; white-space: nowrap; }
  .doc-meta { text-align: right; font-size: 10px; white-space: nowrap; }
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
  .data-box { border: 1px solid #93c5fd; margin-bottom: 14px; }
  .data-box .box-title { background: #dbeafe; font-weight: bold; padding: 4px 8px; border-bottom: 1px solid #93c5fd; font-size: 11px; }
  .data-box .box-table { width: 100%; border-collapse: collapse; margin: 0; }
  .data-box .box-table td { border: none; border-bottom: 1px solid #e5e7eb; padding: 3px 8px; font-size: 10.5px; }
  .data-box .box-table tr:last-child td { border-bottom: none; }
  .data-box .box-table td.label { font-weight: bold; width: 110px; white-space: nowrap; vertical-align: top; }
  .tech-text p, .obs-block p { text-align: justify; line-height: 1.5; }
  .bank-data { margin-top: 6px; }
  .bank-data ul { margin: 4px 0 0; padding-left: 18px; }
  .checklist { list-style: none; padding-left: 0; line-height: 1.7; }
  .signature-area { margin-top: 40px; display: flex; justify-content: space-between; }
  .signature-line { border-top: 1px solid #333; width: 260px; text-align: center; padding-top: 4px; font-size: 10px; }
</style>
</head>
<body>
  <header class="doc-header">
    <div class="brand">
      ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="Logomarca" />` : ""}
      <div class="company-info">
        <h1>${escapeHtml(company?.name ?? "Laboratório")}</h1>
        ${company?.cnpj ? `<div>CNPJ: ${escapeHtml(formatCnpj(company.cnpj))}</div>` : ""}
        ${company?.email ? `<div>${escapeHtml(company.email)}</div>` : ""}
        ${companyAddressHtml}
      </div>
    </div>
    <div class="doc-meta">
      <div><strong>Proposta:</strong> ${escapeHtml(proposal.code)}</div>
      <div><strong>Status:</strong> ${escapeHtml(proposal.status)}</div>
    </div>
  </header>

  ${clientDataBoxHtml}

  <h2>Serviços Solicitados</h2>
  ${pointsHtml || "<p>Nenhum ponto de coleta selecionado.</p>"}

  ${custosSectionHtml}

  ${paymentHtml}

  <h2>Serviços a Serem Realizados por Provedor Externo</h2>
  ${externalProviderHtml}

  ${declaracaoConformidade ? `<h2>Declaração da Conformidade e Regra de Decisão</h2><p>${boldTerms(nl2br(declaracaoConformidade))}</p>` : ""}

  ${validadeProposta ? `<h2>Validade da Proposta</h2><p>${nl2br(validadeProposta)}</p>` : ""}

  ${prazoEntregaRelatorio ? `<h2>Prazo de Entrega do Relatório</h2><p>${nl2br(prazoEntregaRelatorio)}</p>` : ""}

  ${observacoesImportantesHtml ? `<h2>Observações Importantes</h2>${observacoesImportantesHtml}` : ""}

  ${protecaoPropriedadeCliente ? `<h2>Proteção da Propriedade do Cliente</h2><p>${nl2br(protecaoPropriedadeCliente)}</p>` : ""}

  ${confirmacaoProposta ? `<h2>Confirmação da Proposta / Dúvidas</h2><p>${nl2br(confirmacaoProposta)}</p>` : ""}

  ${informacoesAdicionaisHtml}

  ${responsaveisHtml}

  <div class="signature-area">
    <div class="signature-line">${escapeHtml(company?.name ?? "Laboratório")}</div>
    <div class="signature-line">${escapeHtml(proposal.client.corporateName)} (Aceite do cliente)</div>
  </div>
</body>
</html>`;
}
