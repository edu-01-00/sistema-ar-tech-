"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Upload de imagem persistente reutilizável (JPG/PNG), usado na imagem de
// localização de pontos de coleta e na logomarca da empresa.
export function ImageUploadBox({
  label,
  uploadUrl,
  hasImage,
  canManage,
}: {
  label: string;
  uploadUrl: string;
  hasImage: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setSaving(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(uploadUrl, { method: "POST", body: formData });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível enviar a imagem.");
      return;
    }
    router.refresh();
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);
    const res = await fetch(uploadUrl, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível remover a imagem.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <p className="label mb-1">{label}</p>
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <div className="flex items-center gap-3">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${uploadUrl}?t=${Date.now()}`} alt={label} className="h-20 w-28 object-cover border border-gray-200 rounded-md bg-white" />
        ) : (
          <div className="h-20 w-28 border border-dashed border-gray-300 rounded-md flex items-center justify-center text-xs text-gray-400">
            Sem imagem
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
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn-secondary text-xs" disabled={saving} onClick={() => fileInputRef.current?.click()}>
              {saving ? "Enviando..." : hasImage ? "Substituir" : "Enviar imagem"}
            </button>
            {hasImage && (
              <button type="button" className="btn-danger text-xs" disabled={saving} onClick={handleRemove}>
                Remover
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
