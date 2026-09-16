"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  rolePermissions: { permission: { key: string } }[];
  _count: { users: number };
}

const MODULES = Array.from(new Set(PERMISSIONS.map((p) => p.module)));

export function RolesPermissionsPanel({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id ?? "");
  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const [permissionKeys, setPermissionKeys] = useState<string[]>(selectedRole?.rolePermissions.map((rp) => rp.permission.key) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);

  function selectRole(id: string) {
    setSelectedRoleId(id);
    const role = roles.find((r) => r.id === id);
    setPermissionKeys(role?.rolePermissions.map((rp) => rp.permission.key) ?? []);
    setError(null);
  }

  function togglePermission(key: string) {
    setPermissionKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  }

  async function handleSave() {
    if (!selectedRole) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/roles/${selectedRole.id}/permissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionKeys }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível salvar as permissões.");
      return;
    }
    router.refresh();
  }

  async function handleCreateRole() {
    if (!newRoleName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoleName.trim() }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível criar o papel.");
      return;
    }
    setNewRoleName("");
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Papéis e Permissões</h2>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => selectRole(r.id)}
            className={`text-xs px-3 py-1.5 rounded-full border ${r.id === selectedRoleId ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-200"}`}
          >
            {r.name} ({r._count.users})
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input className="input max-w-xs" placeholder="Nome do novo papel" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
        <button className="btn-secondary text-xs" disabled={creating} onClick={handleCreateRole}>
          {creating ? "Criando..." : "Criar papel"}
        </button>
      </div>

      {selectedRole && (
        <div>
          {selectedRole.isSystem && (
            <p className="text-xs text-amber-600 mb-3">
              Este é o papel de Administrador do sistema — possui todas as permissões e não pode ser alterado.
            </p>
          )}
          {MODULES.map((mod) => (
            <div key={mod} className="mb-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">{mod}</p>
              <div className="flex flex-wrap gap-3">
                {PERMISSIONS.filter((p) => p.module === mod).map((p) => (
                  <label key={p.key} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      disabled={selectedRole.isSystem}
                      checked={permissionKeys.includes(p.key)}
                      onChange={() => togglePermission(p.key)}
                    />
                    {p.description}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {!selectedRole.isSystem && (
            <button className="btn-primary text-xs mt-2" disabled={saving} onClick={handleSave}>
              {saving ? "Salvando..." : "Salvar permissões"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
