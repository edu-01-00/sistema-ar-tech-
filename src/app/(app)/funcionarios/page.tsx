import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCpf } from "@/lib/cpf";

export default async function FuncionariosPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await requirePagePermission(["employees.view", "employees.manage"]);
  const canManage = hasPermission(session.user.permissions, "employees.manage");
  const q = searchParams.q?.trim();

  const employees = await prisma.employee.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { cpf: { contains: q.replace(/\D/g, "") } },
            ],
          }
        : {}),
    },
    include: { user: { select: { email: true, active: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Funcionários"
        description="Cadastro de funcionários, documentos e ordens de serviço de EPI."
        actions={canManage && <Link href="/funcionarios/novo" className="btn-primary">Novo funcionário</Link>}
      />

      <div className="mb-4">
        <SearchInput placeholder="Buscar por nome ou CPF..." />
      </div>

      <div className="card overflow-x-auto">
        {employees.length === 0 ? (
          <EmptyState title="Nenhum funcionário encontrado" description="Cadastre o primeiro funcionário para começar." />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Cargo</th>
                <th>Login</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="font-medium text-gray-800">{e.name}</td>
                  <td>{e.cpf ? formatCpf(e.cpf) : "-"}</td>
                  <td>{e.position ?? "-"}</td>
                  <td>{e.user ? e.user.email : <span className="text-gray-400">Sem acesso</span>}</td>
                  <td>
                    <Badge className={e.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}>
                      {e.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td>
                    <Link href={`/funcionarios/${e.id}`} className="text-brand-600 hover:underline text-sm">
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
