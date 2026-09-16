import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { legislationSchema } from "@/lib/validations/legislation";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("legislations.view");
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const showInactive = request.nextUrl.searchParams.get("inactive") === "1";

    const legislations = await prisma.legislation.findMany({
      where: {
        active: showInactive ? undefined : true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { item: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: { legislationTests: { include: { test: true } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ legislations });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("legislations.manage");
    const data = parseBody(legislationSchema, await request.json());

    const legislation = await prisma.legislation.create({
      data: {
        name: data.name,
        description: data.description || null,
        item: data.item || null,
        frameworkProcess: data.frameworkProcess || null,
        allowedLimit: data.allowedLimit || null,
        unit: data.unit || null,
        corrections: data.corrections || null,
        legislationTests: { create: data.testIds.map((testId) => ({ testId })) },
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "Legislation",
      entityId: legislation.id,
      description: `Legislação "${legislation.name}" cadastrada.`,
    });

    return NextResponse.json({ legislation }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
