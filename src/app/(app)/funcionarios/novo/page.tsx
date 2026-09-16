import { requirePagePermission } from "@/lib/guards";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmployeeForm } from "@/components/employees/EmployeeForm";

export default async function NovoFuncionarioPage() {
  await requirePagePermission(["employees.manage"]);

  return (
    <div>
      <PageHeader title="Novo Funcionário" />
      <EmployeeForm />
    </div>
  );
}
