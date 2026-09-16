"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface RoleOption {
  id: string;
  name: string;
}

interface UserInfo {
  id: string;
  email: string;
  active: boolean;
  roleId: string;
  role: { name: string };
}

export function EmployeeUserPanel({
  employeeId,
  user,
  roles,
}: {
  employeeId: string;
  user: UserInfo | null;
  roles: RoleOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState({ email: "", password: "", roleId: roles[0]?.id ?? "" });
  const [roleId, setRoleId] = useState(user?.roleId ?? "");
  const [active, setActive] = useState(user?.active ?? true);
  const [newPassword, setNewPassword] = useState("");

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível criar o login.");
      return;
    }
    router.refresh();
  }

  async function handleUpdate() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/employees/${employeeId}/user`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId, active, password: newPassword || undefined }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível atualizar o acesso.");
      return;
    }
    setNewPassword("");
    router.refresh();
  }

  if (!user) {
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Acesso ao sistema</h2>
        <p className="text-sm text-gray-500 mb-3">Este funcionário ainda não possui um login.</p>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="label">E-mail</label>
            <input type="email" required className="input" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Senha</label>
            <input type="password" required minLength={6} className="input" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className="label">Nível de acesso</label>
            <select className="input" value={createForm.roleId} onChange={(e) => setCreateForm((f) => ({ ...f, roleId: e.target.value }))}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Criando..." : "Criar login"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Acesso ao sistema</h2>
      <p className="text-sm text-gray-600 mb-3">
        E-mail: <strong>{user.email}</strong>
      </p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-3">
        <div>
          <label className="label">Nível de acesso</label>
          <select className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input id="user-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <label htmlFor="user-active" className="text-sm text-gray-700">
            Login ativo
          </label>
        </div>
        <div>
          <label className="label">Nova senha (opcional)</label>
          <input type="password" minLength={6} className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Deixe em branco para manter a atual" />
        </div>
        <button onClick={handleUpdate} disabled={saving} className="btn-primary">
          {saving ? "Salvando..." : "Salvar acesso"}
        </button>
      </div>
    </div>
  );
}
