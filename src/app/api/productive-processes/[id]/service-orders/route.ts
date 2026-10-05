import { NextResponse } from "next/server";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { createServiceOrderSchema } from "@/lib/validations/productive-process";
import { createServiceOrder } from "@/lib/services/productive-process-service";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("productive_processes.manage");
    const data = parseBody(createServiceOrderSchema, await request.json());
    const serviceOrder = await createServiceOrder(session.user.id, params.id, data.items);
    return NextResponse.json({ serviceOrder }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
