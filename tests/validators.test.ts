import { describe, expect, it } from "vitest";
import { isValidCnpj, formatCnpj } from "@/lib/cnpj";
import { isValidCpf, formatCpf } from "@/lib/cpf";

describe("isValidCnpj", () => {
  it("aceita um CNPJ com dígitos verificadores corretos", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });

  it("rejeita CNPJ com dígito verificador incorreto", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
  });

  it("rejeita CNPJ com todos os dígitos iguais", () => {
    expect(isValidCnpj("11111111111111")).toBe(false);
  });

  it("rejeita CNPJ com quantidade de dígitos incorreta", () => {
    expect(isValidCnpj("123")).toBe(false);
  });
});

describe("formatCnpj", () => {
  it("formata um CNPJ limpo no padrão XX.XXX.XXX/XXXX-XX", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("isValidCpf", () => {
  it("aceita um CPF com dígitos verificadores corretos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("rejeita CPF com dígito verificador incorreto", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
  });

  it("rejeita CPF com todos os dígitos iguais", () => {
    expect(isValidCpf("11111111111")).toBe(false);
  });
});

describe("formatCpf", () => {
  it("formata um CPF limpo no padrão XXX.XXX.XXX-XX", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });
});
