import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { getStorageDriver, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/storage";
import { buildFileDownloadResponse } from "@/lib/download-response";

// Imagem da localização do ponto de coleta (item 10 do requisito) — matriz
// Ruído. Upload persistente, com substituição/remoção.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("collection_points.view");
    const detail = await prisma.collectionPointNoise.findUnique({ where: { collectionPointId: params.id } });
    if (!detail?.imageStorageKey) throw new ApiError("Nenhuma imagem cadastrada para este ponto.", 404);

    const buffer = await getStorageDriver().read(detail.imageStorageKey);
    return buildFileDownloadResponse(buffer, detail.imageFileName ?? "imagem", detail.imageMimeType ?? "image/jpeg");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("collection_points.manage");
    const point = await prisma.collectionPoint.findUnique({ where: { id: params.id }, include: { noiseDetail: true } });
    if (!point) throw new ApiError("Ponto de coleta não encontrado.", 404);
    if (point.matrix !== "RUIDO_AMBIENTAL") throw new ApiError("Este ponto não é da matriz Ruído.", 422);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError("Selecione uma imagem para enviar.", 422);
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) throw new ApiError("Apenas imagens JPG ou PNG são permitidas.", 422);
    if (file.size > MAX_IMAGE_SIZE_BYTES) throw new ApiError("A imagem excede o tamanho máximo permitido (5MB).", 422);

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = await getStorageDriver().save({ category: "collection-point-images", fileName: file.name, buffer });
    const previousKey = point.noiseDetail?.imageStorageKey ?? null;

    await prisma.collectionPointNoise.upsert({
      where: { collectionPointId: params.id },
      create: { collectionPointId: params.id, imageStorageKey: storageKey, imageFileName: file.name, imageMimeType: file.type },
      update: { imageStorageKey: storageKey, imageFileName: file.name, imageMimeType: file.type },
    });

    if (previousKey) await getStorageDriver().remove(previousKey);

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "CollectionPoint",
      entityId: point.id,
      description: `Imagem de localização atualizada para o ponto de coleta "${point.name}".`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("collection_points.manage");
    const detail = await prisma.collectionPointNoise.findUnique({ where: { collectionPointId: params.id } });
    if (!detail?.imageStorageKey) throw new ApiError("Nenhuma imagem cadastrada para este ponto.", 404);

    const previousKey = detail.imageStorageKey;
    await prisma.collectionPointNoise.update({
      where: { collectionPointId: params.id },
      data: { imageStorageKey: null, imageFileName: null, imageMimeType: null },
    });
    await getStorageDriver().remove(previousKey);

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "CollectionPoint",
      entityId: params.id,
      description: "Imagem de localização removida do ponto de coleta.",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
