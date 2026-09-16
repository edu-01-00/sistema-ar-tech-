"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import type { Client } from "@prisma/client";

export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const [form, setForm] = useState({
    cnpj: client?.cnpj ?? "",
    corporateName: client?.corporateName ?? "",
    tradeName: client?.tradeName ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    addressStreet: client?.addressStreet ?? "",
    addressNumber: client?.addressNumber ?? "",
    addressComplement: client?.addressComplement ?? "",
    addressDistrict: client?.addressDistrict ?? "",
    addressCity: client?.addressCity ?? "",
    addressState: client?.addressState ?? "",
    addressZipCode: client?.addressZipCode ?? "",
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

    const url = client ? `/api/clients/${client.id}` : "/api/clients";
    const res = await fetch(url, {
      method: client ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível salvar o cliente.");
      return;
    }

    if (client) {
      router.refresh();
    } else {
      const { client: created } = await res.json();
      router.push(`/clientes/${created.id}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4 max-w-2xl">
      {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="CNPJ" required>
          <input className="input" value={form.cnpj} onChange={(e) => update("cnpj", e.target.value)} required />
        </Field>
        <Field label="Razão social" required>
          <input className="input" value={form.corporateName} onChange={(e) => update("corporateName", e.target.value)} required />
        </Field>
        <Field label="Nome fantasia">
          <input className="input" value={form.tradeName ?? ""} onChange={(e) => update("tradeName", e.target.value)} />
        </Field>
        <Field label="E-mail">
          <input type="email" className="input" value={form.email ?? ""} onChange={(e) => update("email", e.target.value)} />
        </Field>
        <Field label="Telefone">
          <input className="input" value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
        </Field>
        <Field label="CEP">
          <input className="input" value={form.addressZipCode ?? ""} onChange={(e) => update("addressZipCode", e.target.value)} />
        </Field>
        <Field label="Logradouro">
          <input className="input" value={form.addressStreet ?? ""} onChange={(e) => update("addressStreet", e.target.value)} />
        </Field>
        <Field label="Número">
          <input className="input" value={form.addressNumber ?? ""} onChange={(e) => update("addressNumber", e.target.value)} />
        </Field>
        <Field label="Complemento">
          <input className="input" value={form.addressComplement ?? ""} onChange={(e) => update("addressComplement", e.target.value)} />
        </Field>
        <Field label="Bairro">
          <input className="input" value={form.addressDistrict ?? ""} onChange={(e) => update("addressDistrict", e.target.value)} />
        </Field>
        <Field label="Cidade">
          <input className="input" value={form.addressCity ?? ""} onChange={(e) => update("addressCity", e.target.value)} />
        </Field>
        <Field label="UF">
          <input className="input" maxLength={2} value={form.addressState ?? ""} onChange={(e) => update("addressState", e.target.value.toUpperCase())} />
        </Field>
      </div>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Salvando..." : client ? "Salvar alterações" : "Cadastrar cliente"}
      </button>
    </form>
  );
}
