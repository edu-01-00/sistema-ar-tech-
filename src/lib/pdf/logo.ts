import type { Company } from "@prisma/client";
import { getStorageDriver } from "@/lib/storage";

// Lê a logomarca da empresa do armazenamento e retorna como data URI, para
// ser embutida diretamente no HTML renderizado em PDF (evita depender de
// uma URL acessível pelo processo do Chromium headless).
export async function getCompanyLogoDataUri(company: Company | null): Promise<string | null> {
  if (!company?.logoStorageKey || !company.logoMimeType) return null;
  try {
    const buffer = await getStorageDriver().read(company.logoStorageKey);
    return `data:${company.logoMimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
