import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError } from "@/lib/api-helpers";

// Item 36: textos padrão administráveis da proposta. Editar um texto aqui
// nunca afeta propostas já emitidas (elas guardam um snapshot próprio em
// ProposalTextSnapshot, copiado no momento da criação).
export async function GET() {
  try {
    await requirePermission("settings.manage");
    const templates = await prisma.proposalTextTemplate.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
    return NextResponse.json({ templates });
  } catch (error) {
    return handleApiError(error);
  }
}
