import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { createProposal } from "@/lib/services/proposal-service";
import { createProposalSchema, PROPOSAL_STATUS_VALUES } from "@/lib/validations/proposal";
import { TEST_MATRIX_VALUES } from "@/lib/validations/test";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("proposals.view");
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const status = PROPOSAL_STATUS_VALUES.find((s) => s === request.nextUrl.searchParams.get("status"));
    const matrix = TEST_MATRIX_VALUES.find((m) => m === request.nextUrl.searchParams.get("matrix"));
    const showAllRevisions = request.nextUrl.searchParams.get("allRevisions") === "1";

    const proposals = await prisma.proposal.findMany({
      where: {
        supersededAt: showAllRevisions ? undefined : null,
        status,
        matrices: matrix ? { some: { matrix } } : undefined,
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" as const } },
                { client: { corporateName: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      include: { client: { select: { corporateName: true } }, matrices: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ proposals });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("proposals.manage");
    const data = parseBody(createProposalSchema, await request.json());

    const proposal = await createProposal(session.user.id, data);

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
