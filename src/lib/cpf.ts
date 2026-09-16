import { cleanDocumentNumber } from "@/lib/cnpj";

export function isValidCpf(rawValue: string): boolean {
  const cpf = cleanDocumentNumber(rawValue);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcCheckDigit = (base: string, factorStart: number) => {
    const sum = base
      .split("")
      .reduce((acc, digit, index) => acc + Number(digit) * (factorStart - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const firstDigit = calcCheckDigit(cpf.slice(0, 9), 10);
  if (firstDigit !== Number(cpf[9])) return false;

  const secondDigit = calcCheckDigit(cpf.slice(0, 10), 11);
  if (secondDigit !== Number(cpf[10])) return false;

  return true;
}

export function formatCpf(rawValue: string): string {
  const cpf = cleanDocumentNumber(rawValue);
  if (cpf.length !== 11) return rawValue;
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
