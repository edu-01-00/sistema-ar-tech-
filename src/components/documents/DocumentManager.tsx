"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

export interface DocumentItem {
  id: string;
  fileName: string;
  size: number;
  createdAt: string | Date;
  category?: string | null;
  categoryLabel?: string | null;
}

export interface DocumentCategoryOption {
  value: string;
  label: string;
  /** Nome do grupo exibido no select (ex: "Contratação"). */
  group?: string;
}

// Componente reutilizável de gestão de documentos (upload/listar/baixar/excluir),
// usado pela Empresa e pelos Funcionários. Mantém toda a lógica de upload em
// um único lugar para consistência de validação e feedback ao usuário.
//
// Quando `categories` é informado, os documentos existentes são filtrados
// pela categoria selecionada: ao escolher uma categoria que já possui
// documentos, eles aparecem na lista antes de qualquer novo envio — evitando
// duplicar documentos que já existem para aquela categoria.
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
  categories?: DocumentCategoryOption[];
}) {
  const router = useRouter();
  const uploadUrl = documentsBaseUrl;
  const downloadUrlFor = (id: string) => `${documentsBaseUrl}/${id}/download`;
  const deleteUrlFor = (id: string) => `${documentsBaseUrl}/${id}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(categories?.[0]?.value ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = categories
    ? categories.reduce<Map<string, DocumentCategoryOption[]>>((acc, opt) => {
        const key = opt.group ?? "";
        acc.set(key, [...(acc.get(key) ?? []), opt]);
        return acc;
      }, new Map())
    : null;

  const visibleDocuments = categories ? documents.filter((d) => d.category === category) : documents;

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
          {groups && (
            <select className="input sm:max-w-[260px]" value={category} onChange={(e) => setCategory(e.target.value)}>
              {[...groups.entries()].map(([groupName, opts]) =>
                groupName ? (
                  <optgroup key={groupName} label={groupName}>
                    {opts.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  opts.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))
                ),
              )}
            </select>
          )}
          <input ref={fileInputRef} type="file" accept="application/pdf" className="input" />
          <button onClick={handleUpload} disabled={uploading} className="btn-primary shrink-0">
            {uploading ? "Enviando..." : "Enviar PDF"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      {categories && (
        <p className="text-xs text-gray-500 mb-2">
          Exibindo documentos da categoria selecionada. Escolha outra categoria acima para ver os documentos já enviados nela antes de enviar um novo.
        </p>
      )}

      {visibleDocuments.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum documento enviado{categories ? " nesta categoria" : ""}.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visibleDocuments.map((doc) => (
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
