import { prisma } from "@/lib/prisma";
import { requirePageSession } from "@/lib/guards";
import { PageHeader } from "@/components/ui/PageHeader";

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-semibold text-gray-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requirePageSession();

  const [
    clientsCount,
    employeesCount,
    testsCount,
    collectionPointsCount,
    proposalsByStatus,
  ] = await Promise.all([
    prisma.client.count({ where: { active: true } }),
    prisma.employee.count({ where: { active: true } }),
    prisma.test.count({ where: { active: true } }),
    prisma.collectionPoint.count({ where: { active: true } }),
    prisma.proposal.groupBy({
      by: ["status"],
      where: { supersededAt: null },
      _count: { _all: true },
    }),
  ]);

  const statusCount = (status: string) => proposalsByStatus.find((p) => p.status === status)?._count._all ?? 0;

  return (
    <div>
      <PageHeader title={`Bem-vindo, ${session.user.name}`} description="Resumo geral do sistema." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Clientes ativos" value={clientsCount} />
        <StatCard label="Funcionários ativos" value={employeesCount} />
        <StatCard label="Ensaios ativos" value={testsCount} />
        <StatCard label="Pontos de coleta ativos" value={collectionPointsCount} />
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Propostas comerciais</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Em elaboração" value={statusCount("EM_ELABORACAO")} />
        <StatCard label="Enviadas / em aberto" value={statusCount("ENVIADA")} />
        <StatCard label="Aprovadas" value={statusCount("APROVADA")} />
        <StatCard label="Não aprovadas" value={statusCount("NAO_APROVADA")} />
      </div>
    </div>
  );
}
