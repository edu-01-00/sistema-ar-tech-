import { chromium } from "playwright-core";

// Gera um PDF a partir de HTML usando o Chromium (via Playwright), já
// pré-instalado no ambiente. Mantido como um único ponto de integração para
// facilitar a troca por outro mecanismo de geração de PDF no futuro.
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const executablePath = process.env.PDF_CHROMIUM_EXECUTABLE_PATH || undefined;
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
