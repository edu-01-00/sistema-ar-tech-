"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

export interface DocumentItem {
  id: string;
  fileName: string;
  size: number;
  createdAt: string | Date;
  categoryLabel?: string | null;
}

// Componente reutilizável de gestão de documentos (upload/listar/baixar/excluir),
// usado pela Empresa e pelos Funcionários. Mantém toda a lógica de upload em
// um único lugar para consistência de validação e feedback ao usuário.
export function DocumentManager({
  documents,
  documentsBaseUrl,
  canManage,
  categories,
}: {
  documents: DocumentItem[];
  /** URL da coleção de documentos (ex: "/api/company/documents"). Download
   * e exclusão são derivados como `${documentsBaseUrl}/${id}` e
   * `${documentsBaseUrl}/${id}/download`. */
  documentsBaseUrl: string;
  canManage: boolean;
  categories?: { value: string; label: string }[];
}) {
  const router = useRouter();
  const uploadUrl = documentsBaseUrl;
  const downloadUrlFor = (id: string) => `${documentsBaseUrl}/${id}/download`;
  const deleteUrlFor = (id: string) => `${documentsBaseUrl}/${id}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(categories?.[0]?.value ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo PDF.");
      return;
    }
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (categories) formData.append("category", category);

    try {
      const res = await fetch(uploadUrl, { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Não foi possível enviar o documento.");
        return;
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.")) return;
    const res = await fetch(deleteUrlFor(id), { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "Não foi possível excluir o documento.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">Documentos</h2>

      {canManage && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          {categories && (
            <select className="input sm:max-w-[220px]" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
          <input ref={fileInputRef} type="file" accept="application/pdf" className="input" />
          <button onClick={handleUpload} disabled={uploading} className="btn-primary shrink-0">
            {uploading ? "Enviando..." : "Enviar PDF"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {documents.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum documento enviado.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {documents.map((doc) => (
            <li key={doc.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-800 truncate">{doc.fileName}</p>
                <p className="text-xs text-gray-400">
                  {doc.categoryLabel ? `${doc.categoryLabel} · ` : ""}
                  {(doc.size / 1024).toFixed(0)} KB · {formatDateTime(doc.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={downloadUrlFor(doc.id)} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
                  Baixar
                </a>
                {canManage && (
                  <button onClick={() => handleDelete(doc.id)} className="btn-danger text-xs">
                    Excluir
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
