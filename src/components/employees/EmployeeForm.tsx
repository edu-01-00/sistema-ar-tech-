"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import type { Employee } from "@prisma/client";

export function EmployeeForm({ employee }: { employee?: Employee }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: employee?.name ?? "",
    cpf: employee?.cpf ?? "",
    email: employee?.email ?? "",
    phone: employee?.phone ?? "",
    position: employee?.position ?? "",
    registrationNumber: employee?.registrationNumber ?? "",
    hiredAt: employee?.hiredAt ? new Date(employee.hiredAt).toISOString().slice(0, 10) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const url = employee ? `/api/employees/${employee.id}` : "/api/employees";
    const res = await fetch(url, {
      method: employee ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível salvar o funcionário.");
      return;
    }

    if (employee) {
      router.refresh();
    } else {
      const { employee: created } = await res.json();
      router.push(`/funcionarios/${created.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4 max-w-2xl">
      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome completo" required>
          <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </Field>
        <Field label="CPF">
          <input className="input" value={form.cpf ?? ""} onChange={(e) => update("cpf", e.target.value)} placeholder="000.000.000-00" />
        </Field>
        <Field label="E-mail">
          <input type="email" className="input" value={form.email ?? ""} onChange={(e) => update("email", e.target.value)} />
        </Field>
        <Field label="Telefone">
          <input className="input" value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
        </Field>
        <Field label="Cargo">
          <input className="input" value={form.position ?? ""} onChange={(e) => update("position", e.target.value)} />
        </Field>
        <Field label="Número de registro">
          <input className="input" value={form.registrationNumber ?? ""} onChange={(e) => update("registrationNumber", e.target.value)} />
        </Field>
        <Field label="Data de admissão">
          <input type="date" className="input" value={form.hiredAt} onChange={(e) => update("hiredAt", e.target.value)} />
        </Field>
      </div>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Salvando..." : employee ? "Salvar alterações" : "Cadastrar funcionário"}
      </button>
    </form>
  );
}
