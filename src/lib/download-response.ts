import { NextResponse } from "next/server";

export function buildFileDownloadResponse(buffer: Buffer, fileName: string, mimeType: string): NextResponse {
  const body = new Uint8Array(buffer);
  return new NextResponse(body, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
