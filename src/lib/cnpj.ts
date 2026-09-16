// Validação de CNPJ (dígitos verificadores), usada tanto no frontend
// (validações de formulário) quanto no backend (zod schemas).
export function cleanDocumentNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCnpj(rawValue: string): boolean {
  const cnpj = cleanDocumentNumber(rawValue);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcCheckDigit = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const firstDigit = calcCheckDigit(cnpj.slice(0, 12), firstWeights);
  if (firstDigit !== Number(cnpj[12])) return false;

  const secondDigit = calcCheckDigit(cnpj.slice(0, 13), secondWeights);
  if (secondDigit !== Number(cnpj[13])) return false;

  return true;
}

export function formatCnpj(rawValue: string): string {
  const cnpj = cleanDocumentNumber(rawValue);
  if (cnpj.length !== 14) return rawValue;
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
