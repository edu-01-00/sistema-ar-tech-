import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProposalWizard } from "@/components/proposals/ProposalWizard";
import type { WizardClient } from "@/components/proposals/types";

export default async function NovaPropostaPage() {
  await requirePagePermission(["proposals.manage"]);

  const [clientsRaw, technicalTexts, company] = await Promise.all([
    prisma.client.findMany({
      where: { active: true },
      include: {
        contacts: { where: { active: true }, orderBy: { name: "asc" } },
        collectionPoints: {
          where: { active: true },
          include: { collectionPointTests: { include: { test: true } } },
        },
      },
      orderBy: { corporateName: "asc" },
    }),
    prisma.technicalText.findMany(),
    prisma.company.findFirst({
      select: { bankName: true, bankAgency: true, bankAccount: true, bankAccountType: true, bankPixKey: true },
    }),
  ]);

  const clients: WizardClient[] = clientsRaw.map((c) => ({
    id: c.id,
    corporateName: c.corporateName,
    contacts: c.contacts.map((ct) => ({ id: ct.id, name: ct.name, role: ct.role })),
    collectionPoints: c.collectionPoints.map((p) => ({
      id: p.id,
      name: p.name,
      matrix: p.matrix,
      tests: p.collectionPointTests
        .filter((cpt) => cpt.test.active)
        .map((cpt) => ({
          id: cpt.test.id,
          name: cpt.test.name,
          method: cpt.test.method,
          unit: cpt.test.unit,
          parameterCode: cpt.test.parameterCode,
          value: Number(cpt.test.value),
          matrix: cpt.test.matrix,
        })),
    })),
  }));

  return (
    <div>
      <PageHeader title="Nova Proposta Comercial" />
      <ProposalWizard
        clients={clients}
        technicalTexts={technicalTexts.map((t) => ({ matrix: t.matrix, title: t.title, content: t.content }))}
        company={company}
      />
    </div>
  );
}
