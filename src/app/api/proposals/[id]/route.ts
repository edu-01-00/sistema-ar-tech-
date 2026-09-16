import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { proposalDetailInclude } from "@/lib/services/proposal-service";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("proposals.view");
    const proposal = await prisma.proposal.findUnique({
      where: { id: params.id },
      include: proposalDetailInclude,
    });
    if (!proposal) throw new ApiError("Proposta não encontrada.", 404);
    return NextResponse.json({ proposal });
  } catch (error) {
    return handleApiError(error);
  }
}
