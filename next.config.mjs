/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: false,
  },
  // puppeteer-core e @sparticuz/chromium são dependências nativas do Node
  // (usadas para gerar PDFs) e não devem ser processadas pelo bundler do
  // Next.js no lado do servidor — precisam ser resolvidas via require() em
  // tempo de execução para que os binários do Chromium sejam encontrados.
  experimental: {
    serverComponentsExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
    outputFileTracingIncludes: {
      "/api/employees/[id]/epi-orders": ["node_modules/@sparticuz/chromium/**"],
      "/api/epi-orders/[id]/accept": ["node_modules/@sparticuz/chromium/**"],
      "/api/proposals/[id]/pdf": ["node_modules/@sparticuz/chromium/**"],
    },
  },
};

export default nextConfig;
