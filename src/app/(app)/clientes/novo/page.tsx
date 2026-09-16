import { requirePagePermission } from "@/lib/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClientForm } from "@/components/clients/ClientForm";

export default async function NovoClientePage() {
  await requirePagePermission(["clients.manage"]);

  return (
    <div>
      <PageHeader title="Novo Cliente" />
      <ClientForm />
    </div>
  );
}
