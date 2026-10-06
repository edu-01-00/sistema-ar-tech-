import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, handleApiError, ApiError } from "@/lib/api-helpers";

// Ficha de EPI: um registro único por funcionário (vínculo 1:1). Esta rota
// busca a ficha existente ou cria uma vazia na primeira vez que a tela do
// funcionário é aberta — não há um "formulário de criação" com campos
// próprios, pois a ficha apenas agrupa funcionário + itens de EPI + assinatura.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission("employees.epi.manage");

    const employee = await prisma.employee.findUnique({ where: { id: params.id } });
    if (!employee) throw new ApiError("Funcionário não encontrado.", 404);

    let epiRecord = await prisma.epiRecord.findUnique({
      where: { employeeId: employee.id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });

    if (!epiRecord) {
      epiRecord = await prisma.epiRecord
        .create({
          data: { employeeId: employee.id, createdById: session.user.id },
          include: { items: { orderBy: { createdAt: "asc" } } },
        })
        .catch(async () => {
          // corrida: outra requisição criou a ficha simultaneamente (employeeId é único)
          return prisma.epiRecord.findUniqueOrThrow({
            where: { employeeId: employee.id },
            include: { items: { orderBy: { createdAt: "asc" } } },
          });
        });
    }

    return NextResponse.json({ epiRecord, employee });
  } catch (error) {
    return handleApiError(error);
  }
}
