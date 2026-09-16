import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, parseBody, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { clientContactSchema } from "@/lib/validations/client";

export async function PUT(request: NextRequest, { params }: { params: { id: string; contactId: string } }) {
  try {
    const session = await requirePermission("clients.manage");
    const data = parseBody(clientContactSchema, await request.json());

    const existing = await prisma.clientContact.findUnique({ where: { id: params.contactId, clientId: params.id } });
    if (!existing) throw new ApiError("Contato não encontrado.", 404);

    const contact = await prisma.clientContact.update({
      where: { id: existing.id },
      data: { name: data.name, email: data.email || null, phone: data.phone || null, role: data.role || null },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "ClientContact",
      entityId: contact.id,
      description: `Contato "${contact.name}" atualizado.`,
    });

    return NextResponse.json({ contact });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(_request: Request, { params }: { params: { id: string; contactId: string } }) {
  try {
    const session = await requirePermission("clients.manage");
    const existing = await prisma.clientContact.findUnique({ where: { id: params.contactId, clientId: params.id } });
    if (!existing) throw new ApiError("Contato não encontrado.", 404);

    const contact = await prisma.clientContact.update({ where: { id: existing.id }, data: { active: !existing.active } });

    await writeAuditLog({
      userId: session.user.id,
      action: contact.active ? "ACTIVATE" : "DEACTIVATE",
      entityType: "ClientContact",
      entityId: contact.id,
      description: `Contato "${contact.name}" ${contact.active ? "reativado" : "desativado"}.`,
    });

    return NextResponse.json({ contact });
  } catch (error) {
    return handleApiError(error);
  }
}
