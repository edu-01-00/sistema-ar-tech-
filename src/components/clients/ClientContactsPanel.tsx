"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import type { ClientContact } from "@prisma/client";

export function ClientContactsPanel({ clientId, contacts }: { clientId: string; contacts: ClientContact[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!form.name.trim()) {
      setError("Informe o nome do contato.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível cadastrar o contato.");
      return;
    }
    setForm({ name: "", email: "", phone: "", role: "" });
    setAdding(false);
    router.refresh();
  }

  async function toggleActive(contact: ClientContact) {
    const res = await fetch(`/api/clients/${clientId}/contacts/${contact.id}`, { method: "PATCH" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "Não foi possível atualizar o contato.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-800">Pessoas de contato</h2>
        <button className="btn-secondary text-xs" onClick={() => setAdding((v) => !v)}>
          {adding ? "Cancelar" : "Adicionar contato"}
        </button>
      </div>

      {adding && (
        <div className="border border-gray-200 rounded-md p-3 mb-4 space-y-2">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <input className="input" placeholder="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="E-mail" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <input className="input" placeholder="Telefone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <input className="input" placeholder="Cargo" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
          <button onClick={handleAdd} disabled={saving} className="btn-primary text-xs">
            {saving ? "Salvando..." : "Salvar contato"}
          </button>
        </div>
      )}

      {contacts.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum contato cadastrado.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {contacts.map((c) => (
            <li key={c.id} className="py-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-800">
                  {c.name} {c.role && <span className="text-gray-400">— {c.role}</span>}
                </p>
                <p className="text-xs text-gray-400">{[c.email, c.phone].filter(Boolean).join(" · ") || "Sem dados de contato"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={c.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}>
                  {c.active ? "Ativo" : "Inativo"}
                </Badge>
                <button className="text-xs text-brand-600 hover:underline" onClick={() => toggleActive(c)}>
                  {c.active ? "Desativar" : "Reativar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
