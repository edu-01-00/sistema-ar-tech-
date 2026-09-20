import puppeteer, { type Browser } from "puppeteer-core";

// Gera um PDF a partir de HTML. Usa dois caminhos conforme o ambiente:
// - Produção (Vercel/serverless): Chromium empacotado pelo @sparticuz/chromium,
//   compatível com o filesystem somente-leitura das funções serverless.
// - Desenvolvimento local: Chromium já instalado na máquina/container,
//   apontado por PDF_CHROMIUM_EXECUTABLE_PATH.
// Mantido como único ponto de integração para facilitar troca futura.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

async function launchBrowser(): Promise<Browser> {
  if (isServerless) {
    const { default: chromium } = await import("@sparticuz/chromium");
    return puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: true,
    });
  }

  const executablePath = process.env.PDF_CHROMIUM_EXECUTABLE_PATH;
  if (!executablePath) {
    throw new Error(
      "PDF_CHROMIUM_EXECUTABLE_PATH não configurado. Defina no .env apontando para um Chromium/Chrome instalado localmente.",
    );
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
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
