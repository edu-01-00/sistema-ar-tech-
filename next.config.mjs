/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: false,
  },
  // playwright-core é uma dependência nativa do Node (usada para gerar PDFs)
  // e não deve ser processada pelo bundler do Next.js no lado do servidor.
  experimental: {
    serverComponentsExternalPackages: ["playwright-core"],
  },
};

export default nextConfig;
