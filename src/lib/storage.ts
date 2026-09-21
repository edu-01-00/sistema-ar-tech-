import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";

// Abstração de armazenamento de arquivos. A implementação padrão grava em
// disco local (pasta configurada em STORAGE_LOCAL_PATH), mas a interface
// permite trocar por um provedor externo (S3, Supabase Storage, etc.) sem
// alterar o restante da aplicação — basta implementar StorageDriver.
export interface StorageDriver {
  save(params: { category: string; fileName: string; buffer: Buffer }): Promise<string>;
  read(storageKey: string): Promise<Buffer>;
  remove(storageKey: string): Promise<void>;
}

function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base : "arquivo";
}

function sanitizeCategory(category: string): string {
  const clean = category.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) throw new Error("Categoria de armazenamento inválida.");
  return clean;
}

class LocalStorageDriver implements StorageDriver {
  private root: string;

  constructor(root: string) {
    this.root = root;
  }

  private resolveKeyPath(storageKey: string): string {
    // storageKey é sempre gerado por nós (save), nunca vindo diretamente do
    // usuário, então não há risco de path traversal aqui — ainda assim
    // validamos que o resultado permanece dentro da raiz configurada.
    const resolved = path.resolve(this.root, storageKey);
    if (!resolved.startsWith(path.resolve(this.root))) {
      throw new Error("Caminho de armazenamento inválido.");
    }
    return resolved;
  }

  async save(params: { category: string; fileName: string; buffer: Buffer }): Promise<string> {
    const category = sanitizeCategory(params.category);
    const fileName = sanitizeFileName(params.fileName);
    const storageKey = path.join(category, `${randomUUID()}-${fileName}`);
    const fullPath = this.resolveKeyPath(storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, params.buffer);
    return storageKey;
  }

  async read(storageKey: string): Promise<Buffer> {
    const fullPath = this.resolveKeyPath(storageKey);
    return fs.readFile(fullPath);
  }

  async remove(storageKey: string): Promise<void> {
    const fullPath = this.resolveKeyPath(storageKey);
    await fs.rm(fullPath, { force: true });
  }
}

let driver: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (!driver) {
    const configuredDriver = process.env.STORAGE_DRIVER ?? "local";
    if (configuredDriver !== "local") {
      throw new Error(`Driver de armazenamento "${configuredDriver}" não implementado.`);
    }
    const root = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_PATH ?? "./storage");
    driver = new LocalStorageDriver(root);
  }
  return driver;
}

export const ALLOWED_DOCUMENT_MIME_TYPES = ["application/pdf"];
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

// Usado para logomarca da empresa e imagens de localização de pontos de coleta.
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png"];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
