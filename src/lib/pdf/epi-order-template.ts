import type { Company, Employee, EpiOrder, EpiOrderItem } from "@prisma/client";
import { formatDateTime } from "@/lib/format";
import { escapeHtml } from "@/lib/pdf/html-utils";

export function buildEpiOrderHtml(
  order: EpiOrder & { items: EpiOrderItem[] },
  employee: Employee,
  company: Company | null,
): string {
  const itemsHtml = order.items.map((item) => `<li>${escapeHtml(item.nameSnapshot)}</li>`).join("");

  const acceptanceHtml = order.acceptedAt
    ? `
      <div class="acceptance-box">
        <p><strong>Declaração de concordância:</strong> Eu, <strong>${escapeHtml(order.acceptedName)}</strong>,
        declaro estar ciente da obrigatoriedade do uso dos Equipamentos de Proteção Individual (EPIs) listados
        nesta Ordem de Serviço durante a execução das minhas atividades.</p>
        <p><strong>Data/hora do aceite:</strong> ${formatDateTime(order.acceptedAt)}</p>
      </div>`
    : `<div class="acceptance-box pending">Aceite pendente de confirmação pelo funcionário.</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Ordem de Serviço ${escapeHtml(order.code)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; }
  h1 { font-size: 18px; color: #1d4ed8; margin-bottom: 2px; }
  h2 { font-size: 14px; border-bottom: 2px solid #1d4ed8; padding-bottom: 4px; margin-top: 20px; }
  .meta { text-align: right; }
  header { display: flex; justify-content: space-between; border-bottom: 3px solid #1d4ed8; padding-bottom: 10px; }
  ul { line-height: 1.6; }
  .acceptance-box { margin-top: 24px; border: 1px solid #999; padding: 12px; border-radius: 6px; }
  .acceptance-box.pending { color: #b45309; background: #fffbeb; }
  footer { margin-top: 30px; font-size: 9px; color: #666; text-align: center; }
</style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(company?.name ?? "Laboratório")}</h1>
      ${company?.cnpj ? `<div>CNPJ: ${escapeHtml(company.cnpj)}</div>` : ""}
    </div>
    <div class="meta">
      <div><strong>Ordem de Serviço:</strong> ${escapeHtml(order.code)}</div>
      <div><strong>Emitida em:</strong> ${formatDateTime(order.issuedAt)}</div>
    </div>
  </header>

  <h2>Ordem de Serviço para Uso de EPI</h2>
  <p><strong>Funcionário:</strong> ${escapeHtml(employee.name)}${employee.position ? ` — ${escapeHtml(employee.position)}` : ""}</p>

  <h2>Equipamentos de Proteção Individual (EPIs)</h2>
  <ul>${itemsHtml || "<li>Nenhum EPI informado.</li>"}</ul>

  ${acceptanceHtml}

  <footer>Documento gerado automaticamente pelo sistema de gestão do laboratório.</footer>
</body>
</html>`;
}
