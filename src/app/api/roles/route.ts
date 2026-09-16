import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requirePermission("users.manage");
    const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ roles });
  } catch (error) {
    return handleApiError(error);
  }
}
