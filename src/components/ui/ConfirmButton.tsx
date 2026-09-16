"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

// Botão de ação com confirmação prévia, usado para operações sensíveis
// (excluir, desativar, cancelar). Mostra estado de carregamento e traduz
// erros da API para mensagens amigáveis via alert (mantém a UI simples).
export function ConfirmButton({
  confirmMessage,
  url,
  method = "DELETE",
  body,
  label,
  className,
  onSuccess,
}: {
  confirmMessage: string;
  url: string;
  method?: "DELETE" | "PATCH" | "POST" | "PUT";
  body?: Record<string, unknown>;
  label: string;
  className?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    setLoading(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error ?? "Não foi possível concluir a operação.");
        return;
      }
      onSuccess?.();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" disabled={loading} onClick={handleClick} className={clsx("btn-danger text-xs", className)}>
      {loading ? "Aguarde..." : label}
    </button>
  );
}
