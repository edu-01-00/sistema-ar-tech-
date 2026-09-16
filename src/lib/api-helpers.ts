import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { ZodError, type ZodType } from "zod";
import { authOptions } from "@/lib/auth";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

// Erro de aplicação com mensagem segura para exibir ao usuário final.
// Detalhes técnicos (stack, causa) são logados no servidor, nunca expostos.
export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new ApiError("Sessão expirada. Faça login novamente.", 401);
  }
  return session;
}

export async function requirePermission(key: PermissionKey): Promise<Session> {
  const session = await requireSession();
  if (!hasPermission(session.user.permissions, key)) {
    throw new ApiError("Você não tem permissão para realizar esta ação.", 403);
  }
  return session;
}

export async function requireAnyPermission(keys: PermissionKey[]): Promise<Session> {
  const session = await requireSession();
  if (!keys.some((k) => hasPermission(session.user.permissions, k))) {
    throw new ApiError("Você não tem permissão para realizar esta ação.", 403);
  }
  return session;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- necessário para aceitar o tipo de entrada do zod independente do tipo de saída (schemas com `.default()`)
export function parseBody<T>(schema: ZodType<T, any, any>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new ApiError(firstIssue?.message ?? "Dados inválidos.", 422);
  }
  return result.data;
}

// Mapeia erros conhecidos do Prisma para mensagens amigáveis, evitando
// vazar detalhes técnicos (constraint names, SQL, etc.) para o usuário.
function mapPrismaError(error: unknown): ApiError | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const prismaError = error as { code: string; meta?: { target?: string | string[] } };

  if (prismaError.code === "P2002") {
    const target = Array.isArray(prismaError.meta?.target) ? prismaError.meta.target.join(", ") : prismaError.meta?.target;
    return new ApiError(`Já existe um registro com o mesmo ${target ?? "valor"}. Verifique os dados informados.`, 409);
  }
  if (prismaError.code === "P2003") {
    return new ApiError("Não foi possível concluir a operação. Verifique os dados relacionados.", 409);
  }
  if (prismaError.code === "P2025") {
    return new ApiError("Registro não encontrado.", 404);
  }
  return null;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return NextResponse.json({ error: firstIssue?.message ?? "Dados inválidos." }, { status: 422 });
  }

  const prismaError = mapPrismaError(error);
  if (prismaError) {
    return NextResponse.json({ error: prismaError.message }, { status: prismaError.statusCode });
  }

  // eslint-disable-next-line no-console
  console.error("[API_ERROR]", error);
  return NextResponse.json(
    { error: "Não foi possível concluir a operação. Tente novamente ou contate o administrador." },
    { status: 500 },
  );
}
