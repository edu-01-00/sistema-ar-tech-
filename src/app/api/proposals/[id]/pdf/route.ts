import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { proposalDetailInclude } from "@/lib/services/proposal-service";
import { buildProposalHtml } from "@/lib/pdf/proposal-template";
import { renderHtmlToPdf } from "@/lib/pdf/render";
import { buildFileDownloadResponse } from "@/lib/download-response";
import { getCompanyLogoDataUri } from "@/lib/pdf/logo";

// O documento é sempre gerado a partir dos dados atuais salvos no banco
// (nunca a partir de estado temporário do formulário no frontend).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("proposals.view");
    const proposal = await prisma.proposal.findUnique({ where: { id: params.id }, include: proposalDetailInclude });
    if (!proposal) throw new ApiError("Proposta não encontrada.", 404);

    const company = await prisma.company.findFirst();
    const logoDataUri = await getCompanyLogoDataUri(company);
    const html = buildProposalHtml(proposal, company, logoDataUri);
    const pdfBuffer = await renderHtmlToPdf(html);

    return buildFileDownloadResponse(pdfBuffer, `${proposal.code}.pdf`, "application/pdf");
  } catch (error) {
    return handleApiError(error);
  }
}
