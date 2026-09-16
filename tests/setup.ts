import path from "node:path";

try {
  process.loadEnvFile(path.resolve(__dirname, "../.env"));
} catch {
  // Arquivo .env ausente (ex: pipeline de CI com variáveis já exportadas).
}
