import { NextRequest, NextResponse } from "next/server";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { updateProposalStatusSchema } from "@/lib/validations/proposal";
import { changeProposalStatus } from "@/lib/services/proposal-service";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("proposals.status.change");
    const data = parseBody(updateProposalStatusSchema, await request.json());

    const proposal = await changeProposalStatus(session.user.id, params.id, data.status);

    return NextResponse.json({ proposal });
  } catch (error) {
    return handleApiError(error);
  }
}
