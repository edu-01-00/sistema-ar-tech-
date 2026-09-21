import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { collectionPointSchema } from "@/lib/validations/collection-point";
import { TEST_MATRIX_VALUES } from "@/lib/validations/test";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("collection_points.view");
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const clientId = request.nextUrl.searchParams.get("clientId") ?? undefined;
    const matrix = TEST_MATRIX_VALUES.find((m) => m === request.nextUrl.searchParams.get("matrix"));
    const showInactive = request.nextUrl.searchParams.get("inactive") === "1";

    const points = await prisma.collectionPoint.findMany({
      where: {
        active: showInactive ? undefined : true,
        clientId,
        matrix,
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      },
      include: { client: { select: { id: true, corporateName: true } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ collectionPoints: points });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("collection_points.manage");
    const data = parseBody(collectionPointSchema, await request.json());

    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client || !client.active) throw new ApiError("Cliente não encontrado ou inativo.", 404);

    const createData: Prisma.CollectionPointCreateInput = {
      client: { connect: { id: data.clientId } },
      matrix: data.matrix,
      name: data.name,
      collectionPointTests: { create: data.testIds.map((testId) => ({ testId })) },
      collectionPointLegislations: { create: data.legislationIds.map((legislationId) => ({ legislationId })) },
    };

    if (data.matrix === "QUALIDADE_AR" && data.airQuality) {
      createData.airQualityDetail = { create: data.airQuality };
    }
    if (data.matrix === "EMISSOES_ATMOSFERICAS") {
      createData.atmosphericDetail = { create: data.atmospheric ?? {} };
    }
    if (data.matrix === "RUIDO_AMBIENTAL") {
      createData.noiseDetail = { create: data.noise ?? {} };
    }

    const point = await prisma.collectionPoint.create({ data: createData });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "CollectionPoint",
      entityId: point.id,
      description: `Ponto de coleta "${point.name}" cadastrado para o cliente "${client.corporateName}".`,
    });

    return NextResponse.json({ collectionPoint: point }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
