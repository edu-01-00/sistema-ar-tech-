import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requirePermission("employees.epi.manage");
    const epis = await prisma.epi.findMany({ where: { active: true }, orderBy: { name: "asc" } });
    return NextResponse.json({ epis });
  } catch (error) {
    return handleApiError(error);
  }
}
