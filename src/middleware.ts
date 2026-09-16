import { withAuth } from "next-auth/middleware";

// Protege todas as rotas da aplicação (exceto login e assets estáticos) no
// nível do middleware. A verificação de permissões específicas por módulo
// acontece nas próprias rotas de API e nas páginas (defesa em profundidade).
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
