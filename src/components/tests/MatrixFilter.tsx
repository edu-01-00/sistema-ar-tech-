"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MATRIX_LABELS } from "@/lib/format";

export function MatrixFilter({ current }: { current?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const options = [{ value: "", label: "Todas as matrizes" }, ...Object.entries(MATRIX_LABELS).map(([value, label]) => ({ value, label }))];

  return (
    <select
      className="input max-w-xs"
      defaultValue={current ?? ""}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set("matrix", e.target.value);
        else params.delete("matrix");
        router.replace(`${pathname}?${params.toString()}`);
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
