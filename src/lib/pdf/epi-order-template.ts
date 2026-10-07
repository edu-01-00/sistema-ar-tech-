import type { Company, Employee, EpiOrder, EpiOrderItem } from "@prisma/client";
import { formatDateTime } from "@/lib/format";
import { escapeHtml } from "@/lib/pdf/html-utils";

// Texto fixo da Ordem de Serviço (modelo fornecido) — preservado sem
// alterar seu sentido. As referências às Normas Regulamentadoras aparecem
// em itálico, conforme o modelo.
const NR_PARAGRAPH_HTML =
  "Esta ordem de serviço tem como objetivo prevenir atos inseguros visando garantir a saúde e integridade física " +
  "dos profissionais, que executam suas atividades laborais no setor, conforme estabelece a <em>NR-1, item 1,7</em>, " +
  "sobre as condições se segurança e saúde as quais estão expostos, como medida protetiva e tendo como parâmetro os " +
  "agentes físicos, químicos e biológicos citados na <em>NR-9 – Programa de Riscos ambientais</em> (Lei nº 6514 de " +
  "22/12/1977, Portaria nº 3214 de 08/06/1978), bem como os procedimentos de aplicação da <em>NR-6 Equipamento de " +
  "Proteção individual EPI</em>, utilização e aplicação dos procedimentos da <em>NR-35 trabalho em altura</em> que " +
  "estabelece requisitos e medidas de proteção e a <em>NR -17 Ergonomia</em>, de a padronizar comportamentos e " +
  "prevenir acidentes e/ou doenças ocupacionais.";

const DECLARATION_PARAGRAPH =
  "Declaro que recebi as orientações e treinamento que fazem parte desta Ordem de Serviço, bem como uma cópia da " +
  "mesma e comprometendo-me a seguir as orientações que estão contidas nela e reconhecendo serem elas indispensáveis " +
  "a minha segurança e a de meus colegas de trabalho. Também afirmo ter recebido todos dos equipamentos de proteção " +
  "individual de utilização obrigatória para a minha função e comprometo utilizá-los durante a minha jornada de " +
  "trabalho para neutralizar a ação dos agentes nocivos presentes no meu ambiente de trabalho.";

const SAFETY_RECOMMENDATIONS = [
  "Não transite sem o uso de EPI em área de Risco;",
  "Use seus EPIs apenas para a finalidade a que se destinam e mantenha-os sob sua guarda e conservação;",
  "Observe atentamente o meio ambiente do trabalho ao circular na empresa e corrija as condições inseguras encontradas imediatamente;",
  "Não ultrapasse a barreira (cancela) de segurança;",
  "Ao acessar as escadas e transitar nas plataformas utilizar sempre o corrimão.",
];

const WORK_SAFETY_GUIDELINES = [
  "Verifique as condições gerais do ambiente antes do trabalho;",
  "Faça a manutenção preventiva de suas máquinas e equipamentos, se houver alguma alteração comunique o superior e realize o registro;",
  "Não improvise extensões elétricas para instalar equipamentos;",
  "Não executar nenhum tipo de atividade com altura acima de 2m;",
  "Não utilizar adorno (anéis, correntes, relógios), pois podem prender e ser puxados.",
  "Cumprir as normas internas da empresa em que se realiza a atividade",
];

function checklistHtml(items: string[]): string {
  return `<ul class="checklist">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}

export function buildEpiOrderHtml(
  order: EpiOrder & { items: EpiOrderItem[] },
  employee: Employee,
  company: Company | null,
  logoDataUri?: string | null,
): string {
  const itemsHtml = order.items.map((item) => `<li>${escapeHtml(item.nameSnapshot)}</li>`).join("");

  // Setor/cargo vêm do snapshot gravado na emissão (nunca mudam numa OS já
  // emitida, mesmo que o cadastro do funcionário seja alterado depois). Para
  // OS geradas antes desta funcionalidade existir (sem snapshot gravado),
  // usa o dado atual do cadastro como alternativa — nunca houve um valor
  // original registrado para preservar nesse caso.
  const sectorLabel = order.sectorSnapshot ?? employee.sector;
  const positionLabel = order.positionSnapshot ?? employee.position;

  // Assinatura digital: reaproveita o mesmo padrão já existente no sistema
  // (nome + data/hora do aceite). O texto da declaração passou a ficar
  // fixo, acima desta caixa, sob o título "DECLARAÇÃO:" — a caixa mostra
  // apenas a confirmação da assinatura (ou o aviso de pendência).
  const acceptanceHtml = order.acceptedAt
    ? `
      <div class="acceptance-box">
        <p><strong>Assinado digitalmente por:</strong> ${escapeHtml(order.acceptedName)}</p>
        <p><strong>Data/hora da assinatura:</strong> ${formatDateTime(order.acceptedAt)}</p>
      </div>`
    : `<div class="acceptance-box pending">Aceite pendente de confirmação pelo funcionário.</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Ordem de Serviço ${escapeHtml(order.code)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; }
  h1 { font-size: 18px; color: #1d4ed8; margin-bottom: 2px; white-space: nowrap; }
  h2 { font-size: 14px; border-bottom: 2px solid #1d4ed8; padding-bottom: 4px; margin-top: 20px; }
  .meta { text-align: right; white-space: nowrap; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 3px solid #1d4ed8; padding-bottom: 10px; }
  header .brand { display: flex; align-items: center; gap: 12px; }
  header img.logo { max-height: 56px; max-width: 160px; object-fit: contain; flex-shrink: 0; }
  ul { line-height: 1.6; }
  ul.checklist { list-style: none; padding-left: 0; }
  ul.checklist li { position: relative; padding-left: 18px; margin-bottom: 4px; }
  ul.checklist li::before { content: "\\2713"; position: absolute; left: 0; color: #1d4ed8; font-weight: bold; }
  table.employee-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  table.employee-table td { border: 1px solid #999; padding: 6px 10px; width: 50%; }
  .acceptance-box { margin-top: 24px; border: 1px solid #999; padding: 12px; border-radius: 6px; }
  .acceptance-box.pending { color: #b45309; background: #fffbeb; }
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
      <div><strong>Ordem de Serviço:</strong> ${escapeHtml(order.code)}</div>
      <div><strong>Emitida em:</strong> ${formatDateTime(order.issuedAt)}</div>
    </div>
  </header>

  <h2>ORDEM DE SERVIÇO SEGURANÇA E SAÚDE DO TRABALHO</h2>
  <table class="employee-table">
    <tr>
      <td><strong>Nome:</strong> ${escapeHtml(employee.name)}</td>
      <td><strong>Nº de registro:</strong> ${employee.registrationNumber ? escapeHtml(employee.registrationNumber) : "-"}</td>
    </tr>
    <tr>
      <td><strong>Setor:</strong> ${sectorLabel ? escapeHtml(sectorLabel) : "-"}</td>
      <td><strong>Função:</strong> ${positionLabel ? escapeHtml(positionLabel) : "-"}</td>
    </tr>
  </table>
  ${order.activities ? `<p><strong>Atividades a serem realizadas:</strong> ${escapeHtml(order.activities)}</p>` : ""}

  <h2>Equipamentos de Proteção Individual (EPIs)</h2>
  <ul>${itemsHtml || "<li>Nenhum EPI informado.</li>"}</ul>

  <h2>RECOMENDAÇÕES DE SEGURANÇA:</h2>
  ${checklistHtml(SAFETY_RECOMMENDATIONS)}

  <h2>ORIENTAÇÕES DE SEGURANÇA DO TRABALHO:</h2>
  ${checklistHtml(WORK_SAFETY_GUIDELINES)}

  <p>${NR_PARAGRAPH_HTML}</p>

  <h2>DECLARAÇÃO:</h2>
  <p><strong>${escapeHtml(DECLARATION_PARAGRAPH)}</strong></p>

  ${acceptanceHtml}

  <footer>Documento gerado automaticamente pelo sistema de gestão do laboratório.</footer>
</body>
</html>`;
}
