import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { collectionPointSchema } from "@/lib/validations/collection-point";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("collection_points.view");
    const point = await prisma.collectionPoint.findUnique({
      where: { id: params.id },
      include: {
        client: { select: { id: true, corporateName: true } },
        airQualityDetail: true,
        atmosphericDetail: true,
        noiseDetail: true,
        collectionPointTests: { include: { test: true } },
        collectionPointLegislations: { include: { legislation: true } },
      },
    });
    if (!point) throw new ApiError("Ponto de coleta não encontrado.", 404);
    return NextResponse.json({ collectionPoint: point });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("collection_points.manage");
    const data = parseBody(collectionPointSchema, await request.json());

    const existing = await prisma.collectionPoint.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Ponto de coleta não encontrado.", 404);

    const point = await prisma.$transaction(async (tx) => {
      await tx.collectionPointTest.deleteMany({ where: { collectionPointId: params.id } });
      await tx.collectionPointLegislation.deleteMany({ where: { collectionPointId: params.id } });

      const updated = await tx.collectionPoint.update({
        where: { id: params.id },
        data: {
          name: data.name,
          collectionPointTests: { create: data.testIds.map((testId) => ({ testId })) },
          collectionPointLegislations: { create: data.legislationIds.map((legislationId) => ({ legislationId })) },
        },
      });

      if (existing.matrix === "QUALIDADE_AR" && data.airQuality) {
        await tx.collectionPointAirQuality.upsert({
          where: { collectionPointId: params.id },
          create: { collectionPointId: params.id, ...data.airQuality },
          update: { ...data.airQuality },
        });
      }
      if (existing.matrix === "EMISSOES_ATMOSFERICAS") {
        await tx.collectionPointAtmosphericEmission.upsert({
          where: { collectionPointId: params.id },
          create: { collectionPointId: params.id, notes: data.atmosphericNotes || null },
          update: { notes: data.atmosphericNotes || null },
        });
      }
      if (existing.matrix === "RUIDO_AMBIENTAL") {
        await tx.collectionPointNoise.upsert({
          where: { collectionPointId: params.id },
          create: { collectionPointId: params.id, notes: data.noiseNotes || null },
          update: { notes: data.noiseNotes || null },
        });
      }

      return updated;
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "CollectionPoint",
      entityId: point.id,
      description: `Ponto de coleta "${point.name}" atualizado.`,
    });

    return NextResponse.json({ collectionPoint: point });
  } catch (error) {
    return handleApiError(error);
  }
}
