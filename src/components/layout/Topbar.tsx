"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import clsx from "clsx";
import { NAV_ITEMS } from "./Sidebar";
import { hasAnyPermission } from "@/lib/permissions";

export function Topbar({
  userName,
  roleName,
  permissions,
}: {
  userName: string;
  roleName: string;
  permissions: string[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => !item.permissions || hasAnyPermission(permissions, item.permissions));

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <header className="flex items-center justify-between px-4 md:px-6 py-3">
        <button
          className="md:hidden text-gray-600 p-2 -ml-2"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>

        <div className="hidden md:block text-sm text-gray-500">Painel de Gestão</div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-gray-800">{userName}</div>
            <div className="text-xs text-gray-500">{roleName}</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-secondary text-xs">
            Sair
          </button>
        </div>
      </header>

      {mobileOpen && (
        <nav className="md:hidden border-t border-gray-200 px-2 py-2 space-y-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  "block rounded-md px-3 py-2 text-sm font-medium",
                  active ? "bg-brand-600 text-white" : "text-gray-700 hover:bg-gray-100",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
