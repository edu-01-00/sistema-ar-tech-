import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { equipmentSchema } from "@/lib/validations/productive-process";

// Catálogo de equipamentos (sonômetros, bombas, etc.) usado no checklist do
// Plano de Amostragem, com validade de calibração (RBC) para apoiar a
// auditoria da ISO 17025.
export async function GET(request: NextRequest) {
  try {
    await requirePermission("productive_processes.view");
    const showInactive = request.nextUrl.searchParams.get("inactive") === "1";
    const equipment = await prisma.equipment.findMany({
      where: { active: showInactive ? undefined : true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ equipment });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("productive_processes.manage");
    const data = parseBody(equipmentSchema, await request.json());

    let calibrationValidUntil: Date | null = null;
    if (data.calibrationValidUntil) {
      calibrationValidUntil = new Date(data.calibrationValidUntil);
      if (Number.isNaN(calibrationValidUntil.getTime())) throw new ApiError("Data de validade da calibração inválida.", 422);
    }

    const equipment = await prisma.equipment.create({
      data: {
        name: data.name,
        serialNumber: data.serialNumber || null,
        calibrationCertificate: data.calibrationCertificate || null,
        calibrationValidUntil,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "Equipment",
      entityId: equipment.id,
      description: `Equipamento "${equipment.name}" cadastrado.`,
    });

    return NextResponse.json({ equipment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
