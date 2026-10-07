import type { Company, Employee, EpiRecord, EpiRecordItem } from "@prisma/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { escapeHtml } from "@/lib/pdf/html-utils";

const DECLARATION_TEXT =
  "Declaro que recebi da empresa AIRTECH EMISSÕES ATMOSFÉRICAS LTDA, inscrito no CNPJ: 32.295.820/0001-44, " +
  "os Equipamentos de Proteção Individual (EPI), abaixo descriminado(s), adequado a necessidade de meu cargo/função, " +
  "em perfeito estado de conservação e funcionamento, devendo solicitar sua substituição sempre que os mesmos " +
  "estiverem desgastados, danificados, comprometendo-me a usá-los bem como devolvê-los ao término do contrato de " +
  "trabalho, responsabilizando-me pela sua guarda e conservação. Declaro também que, na ocasião do recebimento do " +
  "referido equipamento, fui devidamente treinado pelo Serviço de Segurança da empresa quanto ao seu uso correto, " +
  "conservação e higienização, conforme preceitua a NR-6 e NR-1, atendendo o dispositivo da Lei nº 6.514, aprovado " +
  "pela portaria nº 3.214 de 08/06/78, fundamentada pela CLT artigos 157, 158, 462, comprometendo-me a cumpri-las, " +
  "ciente que constitui ato faltoso a recusa injustificada ao cumprimento. Em caso de dano causado pelo empregado " +
  "ou sua ocorrência de dolo o desconto será lícito.";

export function buildEpiRecordHtml(
  epiRecord: EpiRecord & { items: EpiRecordItem[] },
  employee: Employee,
  company: Company | null,
  logoDataUri?: string | null,
): string {
  const itemsRowsHtml = epiRecord.items
    .map((item) => {
      const signatureCell = item.signedAt
        ? `${escapeHtml(item.signedName)}<br /><span class="small">${formatDateTime(item.signedAt)}</span>`
        : `<span class="pending-text">Pendente</span>`;
      return `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td class="center">${item.quantity}</td>
        <td class="center">${item.caNumber ? escapeHtml(item.caNumber) : "-"}</td>
        <td class="center">${formatDate(item.deliveredAt)}</td>
        <td class="center">${item.returnedAt ? formatDate(item.returnedAt) : "-"}</td>
        <td class="center">${signatureCell}</td>
      </tr>`;
    })
    .join("");

  // Data de admissão/demissão vêm sempre do cadastro atual do funcionário —
  // nunca duplicadas ou congeladas nesta ficha, para nunca divergir do cadastro.
  const admissionLabel = employee.hiredAt ? formatDate(employee.hiredAt) : "-";
  const terminationLabel = employee.terminatedAt ? formatDate(employee.terminatedAt) : "";

  // Assinatura da ficha (única, na admissão) — registro reduzido e alinhado
  // à direita, conforme ajuste solicitado.
  const signatureHtml = epiRecord.signedAt
    ? `
      <div class="signature-box">
        <p><strong>Assinatura digital:</strong> ${escapeHtml(epiRecord.signedName)}</p>
        <p><strong>Data/hora da assinatura:</strong> ${formatDateTime(epiRecord.signedAt)}</p>
      </div>`
    : `<div class="signature-box pending">Assinatura pendente de confirmação pelo funcionário.</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Ficha de EPI - ${escapeHtml(employee.name)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; }
  h1 { font-size: 18px; color: #1d4ed8; margin-bottom: 2px; white-space: nowrap; }
  h2 { font-size: 14px; border-bottom: 2px solid #1d4ed8; padding-bottom: 4px; margin-top: 20px; }
  .meta { text-align: right; white-space: nowrap; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 3px solid #1d4ed8; padding-bottom: 10px; }
  header .brand { display: flex; align-items: center; gap: 12px; }
  header img.logo { max-height: 56px; max-width: 160px; object-fit: contain; flex-shrink: 0; }
  .declaration { margin-top: 10px; text-align: justify; line-height: 1.5; }
  table.employee-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  table.employee-table td { border: 1px solid #999; padding: 6px 10px; width: 50%; }
  table.items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  table.items-table th, table.items-table td { border: 1px solid #ccc; padding: 6px; font-size: 11px; text-align: left; }
  table.items-table th { background: #f1f5f9; }
  td.center, th.center { text-align: center; }
  .small { font-size: 9px; color: #666; }
  .pending-text { color: #b45309; }
  .signature-box { margin-top: 24px; border: 1px solid #999; padding: 8px 12px; border-radius: 6px; font-size: 10px; text-align: right; width: fit-content; margin-left: auto; }
  .signature-box.pending { color: #b45309; background: #fffbeb; text-align: left; width: auto; }
  footer { margin-top: 30px; font-size: 9px; color: #666; text-align: center; }
</style>
</head>
<body>
  <header>
    <div class="brand">
      ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="Logomarca" />` : ""}
      <div>
        <h1>${escapeHtml(company?.name ?? "Laboratório")}</h1>
        ${company?.cnpj ? `<div>CNPJ: ${escapeHtml(company.cnpj)}</div>` : ""}
      </div>
    </div>
    <div class="meta">
      <div><strong>Ficha de EPI</strong></div>
      <div>Setor: SST</div>
    </div>
  </header>

  <h2>Dados do Funcionário</h2>
  <table class="employee-table">
    <tr>
      <td><strong>Nome:</strong> ${escapeHtml(employee.name)}</td>
      <td><strong>Nº de registro:</strong> ${employee.registrationNumber ? escapeHtml(employee.registrationNumber) : "-"}</td>
    </tr>
    <tr>
      <td><strong>Setor:</strong> ${employee.sector ? escapeHtml(employee.sector) : "-"}</td>
      <td><strong>Função:</strong> ${employee.position ? escapeHtml(employee.position) : "-"}</td>
    </tr>
  </table>
  <p><strong>Data de admissão:</strong> ${admissionLabel}</p>
  ${terminationLabel ? `<p><strong>Data de demissão:</strong> ${terminationLabel}</p>` : ""}

  <h2>TERMO DE COMPROMISSO DE ENTREGA DE EPI</h2>
  <p class="declaration">${escapeHtml(DECLARATION_TEXT)}</p>

  ${signatureHtml}

  <h2>Equipamentos de Proteção Individual (EPIs) Entregues</h2>
  <table class="items-table">
    <thead>
      <tr>
        <th>Descrição</th>
        <th class="center">Quantidade</th>
        <th class="center">Nº do CA</th>
        <th class="center">Data de entrega</th>
        <th class="center">Data de devolução</th>
        <th class="center">Assinatura do Funcionário</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRowsHtml || `<tr><td colspan="6">Nenhum EPI registrado.</td></tr>`}
    </tbody>
  </table>

  <footer>Documento gerado automaticamente pelo sistema de gestão do laboratório.</footer>
</body>
</html>`;
}
