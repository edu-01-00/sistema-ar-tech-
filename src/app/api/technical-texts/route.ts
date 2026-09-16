import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";
import { TEST_MATRIX_VALUES } from "@/lib/validations/test";

const updateTechnicalTextSchema = z.object({
  matrix: z.enum(TEST_MATRIX_VALUES),
  title: z.string().trim().min(2, "Informe o título."),
  content: z.string().trim().min(1, "Informe o conteúdo do texto."),
});

export async function GET() {
  try {
    await requirePermission("settings.manage");
    const texts = await prisma.technicalText.findMany({ orderBy: { matrix: "asc" } });
    return NextResponse.json({ texts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePermission("settings.manage");
    const data = parseBody(updateTechnicalTextSchema, await request.json());

    const text = await prisma.technicalText.upsert({
      where: { matrix: data.matrix },
      create: { matrix: data.matrix, title: data.title, content: data.content, updatedById: session.user.id },
      update: { title: data.title, content: data.content, updatedById: session.user.id },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "TechnicalText",
      entityId: text.id,
      description: `Texto técnico da matriz ${data.matrix} atualizado.`,
    });

    return NextResponse.json({ text });
  } catch (error) {
    return handleApiError(error);
  }
}
