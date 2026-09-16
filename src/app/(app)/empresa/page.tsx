import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { CompanyForm } from "@/components/company/CompanyForm";
import { DocumentManager } from "@/components/documents/DocumentManager";

export default async function EmpresaPage() {
  const session = await requirePagePermission(["company.view", "company.manage"]);
  const canManage = hasPermission(session.user.permissions, "company.manage");
  const canManageDocs = hasPermission(session.user.permissions, "company.documents.manage");

  const company = await prisma.company.findFirst({
    include: { documents: { orderBy: { createdAt: "desc" } } },
  });

  return (
    <div>
      <PageHeader title="Empresa" description="Dados cadastrais e documentos do laboratório." />

      <div className="space-y-6 max-w-3xl">
        <CompanyForm company={company} canManage={canManage} />

        <DocumentManager
          documents={company?.documents ?? []}
          documentsBaseUrl="/api/company/documents"
          canManage={canManageDocs}
        />
      </div>
    </div>
  );
}
