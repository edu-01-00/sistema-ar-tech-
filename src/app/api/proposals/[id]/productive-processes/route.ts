import { NextResponse } from "next/server";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { createProductiveProcessSchema } from "@/lib/validations/productive-process";
import { createProductiveProcess } from "@/lib/services/productive-process-service";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("productive_processes.manage");
    const data = parseBody(createProductiveProcessSchema, await request.json());
    const productiveProcess = await createProductiveProcess(session.user.id, {
      proposalId: params.id,
      collectionPointId: data.collectionPointId,
    });
    return NextResponse.json({ productiveProcess }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
