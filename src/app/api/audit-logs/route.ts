import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("audit.view");
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 100), 300);

    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return handleApiError(error);
  }
}
