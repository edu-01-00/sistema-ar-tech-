import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { clientContactSchema } from "@/lib/validations/client";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("clients.manage");
    const data = parseBody(clientContactSchema, await request.json());

    const client = await prisma.client.findUnique({ where: { id: params.id } });
    if (!client) throw new ApiError("Cliente não encontrado.", 404);

    const contact = await prisma.clientContact.create({
      data: {
        clientId: client.id,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        role: data.role || null,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE",
      entityType: "ClientContact",
      entityId: contact.id,
      description: `Contato "${contact.name}" cadastrado para o cliente "${client.corporateName}".`,
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
