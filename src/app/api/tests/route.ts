import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { testSchema, TEST_MATRIX_VALUES } from "@/lib/validations/test";
import { generateParameterCode } from "@/lib/services/test-service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("tests.view");
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const matrixParam = request.nextUrl.searchParams.get("matrix") ?? undefined;
    const matrix = TEST_MATRIX_VALUES.find((m) => m === matrixParam);
    const showInactive = request.nextUrl.searchParams.get("inactive") === "1";

    const tests = await prisma.test.findMany({
      where: {
        active: showInactive ? undefined : true,
        matrix,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { parameterCode: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ tests });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("tests.manage");
    const data = parseBody(testSchema, await request.json());

    const test = await prisma.$transaction(async (tx) => {
      const parameterCode = await generateParameterCode(tx, data.matrix);
      return tx.test.create({
        data: {
          name: data.name,
          method: data.method,
          cas: data.cas || null,
          quantificationLimit: data.quantificationLimit || null,
          isSubcontracted: data.isSubcontracted,
          isAccredited: data.isAccredited,
          unit: data.unit,
          value: data.value,
          matrix: data.matrix,
          parameterCode,
        },
      });
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "Test",
      entityId: test.id,
      description: `Ensaio "${test.name}" (${test.parameterCode}) cadastrado.`,
    });

    return NextResponse.json({ test }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
