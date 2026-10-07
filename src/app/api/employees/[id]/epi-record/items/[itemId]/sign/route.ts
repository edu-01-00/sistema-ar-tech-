import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { epiRecordSignSchema } from "@/lib/validations/employee";

// Assinatura digital do funcionário a cada entrega de EPI — distinta da
// assinatura única da ficha (feita na admissão). Reaproveita o mesmo
// mecanismo simples (nome + data/hora) já usado em todo o sistema. Cada
// item é assinado uma única vez (a assinatura representa o recebimento
// daquela entrega específica).
export async function POST(request: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  try {
    const session = await requirePermission("employees.epi.manage");
    const data = parseBody(epiRecordSignSchema, await request.json());

    const item = await prisma.epiRecordItem.findUnique({
      where: { id: params.itemId },
      include: { epiRecord: true },
    });
    if (!item || item.epiRecord.employeeId !== params.id) throw new ApiError("Item de EPI não encontrado.", 404);
    if (item.signedAt) throw new ApiError("Este item já foi assinado pelo funcionário.", 409);

    const updated = await prisma.epiRecordItem.update({
      where: { id: item.id },
      data: { signedAt: new Date(), signedName: data.signedName },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "ACCEPT",
      entityType: "EpiRecordItem",
      entityId: item.id,
      description: `Recebimento do EPI "${item.description}" assinado por "${data.signedName}".`,
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
