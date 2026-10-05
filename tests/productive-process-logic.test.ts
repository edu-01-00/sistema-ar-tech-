import { describe, expect, it } from "vitest";
import { formatProductiveProcessCode, formatServiceOrderCode } from "@/lib/productive-process-logic";

describe("formatProductiveProcessCode", () => {
  it("formata com número sequencial de 3 dígitos e ano", () => {
    expect(formatProductiveProcessCode(127, 2026)).toBe("PP 127/2026");
    expect(formatProductiveProcessCode(1, 2026)).toBe("PP 001/2026");
    expect(formatProductiveProcessCode(1, 2027)).toBe("PP 001/2027");
  });
});

describe("formatServiceOrderCode", () => {
  it("formata reaproveitando o número-base do Processo Produtivo", () => {
    expect(formatServiceOrderCode(127, 2026, 1)).toBe("OS 127/2026_1");
    expect(formatServiceOrderCode(127, 2026, 2)).toBe("OS 127/2026_2");
    expect(formatServiceOrderCode(1, 2026, 1)).toBe("OS 001/2026_1");
  });
});
