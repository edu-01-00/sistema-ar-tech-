import { NextResponse } from "next/server";
import { requirePermission, handleApiError } from "@/lib/api-helpers";
import { createProposalRevision } from "@/lib/services/proposal-service";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("proposals.manage");
    const revision = await createProposalRevision(session.user.id, params.id);
    return NextResponse.json({ proposal: revision }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
