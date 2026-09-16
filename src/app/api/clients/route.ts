import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { clientSchema } from "@/lib/validations/client";
import { cleanDocumentNumber } from "@/lib/cnpj";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("clients.view");
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const showInactive = request.nextUrl.searchParams.get("inactive") === "1";

    const clients = await prisma.client.findMany({
      where: {
        active: showInactive ? undefined : true,
        ...(q
          ? {
              OR: [
                { corporateName: { contains: q, mode: "insensitive" as const } },
                { tradeName: { contains: q, mode: "insensitive" as const } },
                { cnpj: { contains: cleanDocumentNumber(q) } },
              ],
            }
          : {}),
      },
      orderBy: { corporateName: "asc" },
    });

    return NextResponse.json({ clients });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("clients.manage");
    const data = parseBody(clientSchema, await request.json());

    const client = await prisma.client.create({
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
      action: "CREATE",
      entityType: "Client",
      entityId: client.id,
      description: `Cliente "${client.corporateName}" cadastrado.`,
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
