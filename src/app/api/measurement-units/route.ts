import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { measurementUnitSchema } from "@/lib/validations/measurement-unit";

// Catálogo centralizado de unidades de medida, usado tanto no cadastro de
// Ensaios quanto no de Legislação (item 5-6 do requisito). Uma unidade
// cadastrada aqui fica disponível automaticamente nos dois lugares.
export async function GET(request: NextRequest) {
  try {
    await requirePermission("tests.view");
    const showInactive = request.nextUrl.searchParams.get("inactive") === "1";
    const units = await prisma.measurementUnit.findMany({
      where: { active: showInactive ? undefined : true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ measurementUnits: units });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("measurement_units.manage");
    const data = parseBody(measurementUnitSchema, await request.json());

    const existing = await prisma.measurementUnit.findUnique({ where: { name: data.name } });
    if (existing) throw new ApiError("Esta unidade de medida já está cadastrada.", 409);

    const unit = await prisma.measurementUnit.create({ data: { name: data.name } });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "MeasurementUnit",
      entityId: unit.id,
      description: `Unidade de medida "${unit.name}" cadastrada.`,
    });

    return NextResponse.json({ measurementUnit: unit }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
