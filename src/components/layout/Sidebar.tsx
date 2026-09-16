"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { hasAnyPermission, type PermissionKey } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  permissions?: PermissionKey[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/empresa", label: "Empresa", permissions: ["company.view", "company.manage"] },
  { href: "/funcionarios", label: "Funcionários", permissions: ["employees.view", "employees.manage"] },
  { href: "/ensaios", label: "Ensaios", permissions: ["tests.view", "tests.manage"] },
  { href: "/legislacao", label: "Legislação", permissions: ["legislations.view", "legislations.manage"] },
  { href: "/clientes", label: "Clientes", permissions: ["clients.view", "clients.manage"] },
  { href: "/pontos-coleta", label: "Pontos de Coleta", permissions: ["collection_points.view", "collection_points.manage"] },
  { href: "/propostas", label: "Propostas Comerciais", permissions: ["proposals.view", "proposals.manage"] },
  { href: "/configuracoes", label: "Configurações", permissions: ["users.manage", "roles.manage", "settings.manage", "audit.view"] },
];

export function Sidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => !item.permissions || hasAnyPermission(permissions, item.permissions));

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-brand-900 text-white min-h-screen">
      <div className="px-5 py-5 border-b border-white/10">
        <span className="font-bold text-lg leading-tight">Lab Manager</span>
      </div>
      <nav className="flex-1 py-4 space-y-1 px-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-brand-600 text-white" : "text-brand-100 hover:bg-brand-800",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
