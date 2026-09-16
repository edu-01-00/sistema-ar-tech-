"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import type { Company } from "@prisma/client";

export function CompanyForm({ company, canManage }: { company: Company | null; canManage: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: company?.name ?? "",
    cnpj: company?.cnpj ?? "",
    email: company?.email ?? "",
    addressStreet: company?.addressStreet ?? "",
    addressNumber: company?.addressNumber ?? "",
    addressComplement: company?.addressComplement ?? "",
    addressDistrict: company?.addressDistrict ?? "",
    addressCity: company?.addressCity ?? "",
    addressState: company?.addressState ?? "",
    addressZipCode: company?.addressZipCode ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível salvar os dados da empresa.");
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4">
      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
      {success && <div className="rounded-md bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2">Dados salvos com sucesso.</div>}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome da empresa" required>
          <input className="input" disabled={!canManage} value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </Field>
        <Field label="CNPJ" required>
          <input className="input" disabled={!canManage} value={form.cnpj} onChange={(e) => update("cnpj", e.target.value)} required />
        </Field>
        <Field label="E-mail" required>
          <input type="email" className="input" disabled={!canManage} value={form.email} onChange={(e) => update("email", e.target.value)} required />
        </Field>
        <Field label="CEP">
          <input className="input" disabled={!canManage} value={form.addressZipCode ?? ""} onChange={(e) => update("addressZipCode", e.target.value)} />
        </Field>
        <Field label="Logradouro">
          <input className="input" disabled={!canManage} value={form.addressStreet ?? ""} onChange={(e) => update("addressStreet", e.target.value)} />
        </Field>
        <Field label="Número">
          <input className="input" disabled={!canManage} value={form.addressNumber ?? ""} onChange={(e) => update("addressNumber", e.target.value)} />
        </Field>
        <Field label="Complemento">
          <input className="input" disabled={!canManage} value={form.addressComplement ?? ""} onChange={(e) => update("addressComplement", e.target.value)} />
        </Field>
        <Field label="Bairro">
          <input className="input" disabled={!canManage} value={form.addressDistrict ?? ""} onChange={(e) => update("addressDistrict", e.target.value)} />
        </Field>
        <Field label="Cidade">
          <input className="input" disabled={!canManage} value={form.addressCity ?? ""} onChange={(e) => update("addressCity", e.target.value)} />
        </Field>
        <Field label="UF">
          <input className="input" maxLength={2} disabled={!canManage} value={form.addressState ?? ""} onChange={(e) => update("addressState", e.target.value.toUpperCase())} />
        </Field>
      </div>

      {canManage && (
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Salvando..." : "Salvar dados da empresa"}
        </button>
      )}
    </form>
  );
}
