import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { clientSchema } from "@/lib/validations/client";
import { cleanDocumentNumber } from "@/lib/cnpj";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requirePermission("clients.view");
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: { contacts: { orderBy: { name: "asc" } }, collectionPoints: true },
    });
    if (!client) throw new ApiError("Cliente não encontrado.", 404);
    return NextResponse.json({ client });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("clients.manage");
    const data = parseBody(clientSchema, await request.json());

    const existing = await prisma.client.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Cliente não encontrado.", 404);

    const client = await prisma.client.update({
      where: { id: params.id },
      data: {
        cnpj: cleanDocumentNumber(data.cnpj),
        corporateName: data.corporateName,
        tradeName: data.tradeName || null,
        email: data.email || null,
        phone: data.phone || null,
        addressStreet: data.addressStreet || null,
        addressNumber: data.addressNumber || null,
        addressComplement: data.addressComplement || null,
        addressDistrict: data.addressDistrict || null,
        addressCity: data.addressCity || null,
        addressState: data.addressState || null,
        addressZipCode: data.addressZipCode || null,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Client",
      entityId: client.id,
      description: `Cliente "${client.corporateName}" atualizado.`,
    });

    return NextResponse.json({ client });
  } catch (error) {
    return handleApiError(error);
  }
}
