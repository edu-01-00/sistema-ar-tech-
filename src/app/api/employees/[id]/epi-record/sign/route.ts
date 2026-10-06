import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { epiRecordSignSchema } from "@/lib/validations/employee";

// Assinatura digital da Ficha de EPI: ocorre uma única vez por funcionário
// (na admissão), reaproveitando o mesmo mecanismo simples (nome + data/hora)
// já usado no aceite da Ordem de Serviço de EPI. Itens de EPI adicionados
// depois não exigem nova assinatura.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("employees.epi.manage");
    const data = parseBody(epiRecordSignSchema, await request.json());

    const employee = await prisma.employee.findUnique({ where: { id: params.id } });
    if (!employee) throw new ApiError("Funcionário não encontrado.", 404);

    const epiRecord = await prisma.epiRecord.upsert({
      where: { employeeId: employee.id },
      update: {},
      create: { employeeId: employee.id, createdById: session.user.id },
    });

    if (epiRecord.signedAt) throw new ApiError("A Ficha de EPI deste funcionário já foi assinada.", 409);

    const updated = await prisma.epiRecord.update({
      where: { id: epiRecord.id },
      data: { signedAt: new Date(), signedName: data.signedName },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "ACCEPT",
      entityType: "EpiRecord",
      entityId: epiRecord.id,
      description: `Ficha de EPI de "${employee.name}" assinada por "${data.signedName}".`,
    });

    return NextResponse.json({ epiRecord: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
