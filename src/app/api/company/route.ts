import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { companySchema } from "@/lib/validations/company";

export async function GET() {
  try {
    await requirePermission("company.view");
    const company = await prisma.company.findFirst();
    return NextResponse.json({ company });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePermission("company.manage");
    const data = parseBody(companySchema, await request.json());

    const existing = await prisma.company.findFirst();
    const company = existing
      ? await prisma.company.update({ where: { id: existing.id }, data })
      : await prisma.company.create({ data });

    await writeAuditLog({
      userId: session.user.id,
      action: existing ? "UPDATE" : "CREATE",
      entityType: "Company",
      entityId: company.id,
      description: existing ? "Dados da empresa atualizados." : "Empresa cadastrada.",
    });

    return NextResponse.json({ company });
  } catch (error) {
    return handleApiError(error);
  }
}
