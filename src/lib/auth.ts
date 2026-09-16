import type { AuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

async function computeEffectivePermissions(userId: string, roleId: string): Promise<string[]> {
  const [rolePermissions, userPermissions] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    }),
    prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    }),
  ]);

  const effective = new Set(rolePermissions.map((rp) => rp.permission.key));
  for (const up of userPermissions) {
    if (up.granted) effective.add(up.permission.key);
    else effective.delete(up.permission.key);
  }
  return Array.from(effective);
}

export const authOptions: AuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { role: true },
        });

        if (!user || !user.active) return null;

        const validPassword = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!validPassword) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        const permissions = await computeEffectivePermissions(user.id, user.roleId);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roleId: user.roleId,
          roleName: user.role.name,
          permissions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const typedUser = user as User;
        token.id = typedUser.id;
        token.roleId = typedUser.roleId;
        token.roleName = typedUser.roleName;
        token.permissions = typedUser.permissions;
      }
      // Recarrega as permissões periodicamente para refletir mudanças feitas
      // pelo administrador sem exigir logout/login imediato.
      if (trigger === "update" && token.id && token.roleId) {
        token.permissions = await computeEffectivePermissions(token.id as string, token.roleId as string);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.roleId = token.roleId as string;
        session.user.roleName = token.roleName as string;
        session.user.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
};
