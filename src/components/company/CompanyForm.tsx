"use client";

import { useRef, useState, type FormEvent } from "react";
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
    bankName: company?.bankName ?? "",
    bankAgency: company?.bankAgency ?? "",
    bankAccount: company?.bankAccount ?? "",
    bankAccountType: company?.bankAccountType ?? "",
    bankPixKey: company?.bankPixKey ?? "",
    professionalRegistrationType: company?.professionalRegistrationType ?? "",
    professionalRegistrationNumber: company?.professionalRegistrationNumber ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSaving, setLogoSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const payload = {
      ...form,
      professionalRegistrationType: form.professionalRegistrationType || null,
    };

    const res = await fetch("/api/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  async function handleLogoUpload(file: File) {
    setLogoSaving(true);
    setLogoError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/company/logo", { method: "POST", body: formData });
    setLogoSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLogoError(data.error ?? "Não foi possível enviar a logomarca.");
      return;
    }
    router.refresh();
  }

  async function handleLogoRemove() {
    setLogoSaving(true);
    setLogoError(null);
    const res = await fetch("/api/company/logo", { method: "DELETE" });
    setLogoSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLogoError(data.error ?? "Não foi possível remover a logomarca.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="card p-5 space-y-6">
        {error && <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
        {success && <div className="rounded-md bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2">Dados salvos com sucesso.</div>}

        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Dados cadastrais</h3>
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
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Registro profissional</h3>
          <p className="text-xs text-gray-500 mb-3">Opcional. Não é obrigatório preencher.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Tipo">
              <select
                className="input"
                disabled={!canManage}
                value={form.professionalRegistrationType ?? ""}
                onChange={(e) => update("professionalRegistrationType", e.target.value)}
              >
                <option value="">Não informado</option>
                <option value="CRQ">CRQ</option>
                <option value="CREA">CREA</option>
              </select>
            </Field>
            <Field label="Número do registro">
              <input
                className="input"
                disabled={!canManage}
                value={form.professionalRegistrationNumber ?? ""}
                onChange={(e) => update("professionalRegistrationNumber", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Dados bancários</h3>
          <p className="text-xs text-gray-500 mb-3">
            Usados automaticamente nas propostas quando a forma de pagamento escolhida for Depósito/PIX.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Banco">
              <input className="input" disabled={!canManage} value={form.bankName ?? ""} onChange={(e) => update("bankName", e.target.value)} />
            </Field>
            <Field label="Agência">
              <input className="input" disabled={!canManage} value={form.bankAgency ?? ""} onChange={(e) => update("bankAgency", e.target.value)} />
            </Field>
            <Field label="Conta">
              <input className="input" disabled={!canManage} value={form.bankAccount ?? ""} onChange={(e) => update("bankAccount", e.target.value)} />
            </Field>
            <Field label="Tipo de conta">
              <input className="input" placeholder="Corrente, Poupança..." disabled={!canManage} value={form.bankAccountType ?? ""} onChange={(e) => update("bankAccountType", e.target.value)} />
            </Field>
            <Field label="Chave PIX">
              <input className="input" disabled={!canManage} value={form.bankPixKey ?? ""} onChange={(e) => update("bankPixKey", e.target.value)} />
            </Field>
          </div>
        </div>

        {canManage && (
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Salvando..." : "Salvar dados da empresa"}
          </button>
        )}
      </form>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Logomarca</h3>
        {logoError && <p className="text-xs text-red-600 mb-2">{logoError}</p>}
        <div className="flex items-center gap-4">
          {company?.logoStorageKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/company/logo" alt="Logomarca da empresa" className="h-20 w-auto border border-gray-200 rounded-md bg-white p-1" />
          ) : (
            <div className="h-20 w-32 border border-dashed border-gray-300 rounded-md flex items-center justify-center text-xs text-gray-400">
              Sem logomarca
            </div>
          )}
          {canManage && (
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleLogoUpload(file);
                  e.target.value = "";
                }}
              />
              <button type="button" className="btn-secondary text-xs" disabled={logoSaving} onClick={() => fileInputRef.current?.click()}>
                {logoSaving ? "Enviando..." : company?.logoStorageKey ? "Substituir logomarca" : "Enviar logomarca"}
              </button>
              {company?.logoStorageKey && (
                <button type="button" className="btn-danger text-xs" disabled={logoSaving} onClick={handleLogoRemove}>
                  Remover logomarca
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
