import { requirePagePermission } from "@/lib/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { TestForm } from "@/components/tests/TestForm";

export default async function NovoEnsaioPage() {
  await requirePagePermission(["tests.manage"]);

  return (
    <div>
      <PageHeader title="Novo Ensaio" />
      <TestForm />
    </div>
  );
}
