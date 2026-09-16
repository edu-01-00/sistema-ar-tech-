import { getServerSession, type Session } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasAnyPermission, type PermissionKey } from "@/lib/permissions";

export async function requirePageSession(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session;
}

export async function requirePagePermission(keys: PermissionKey[]): Promise<Session> {
  const session = await requirePageSession();
  if (!hasAnyPermission(session.user.permissions, keys)) {
    redirect("/acesso-negado");
  }
  return session;
}
