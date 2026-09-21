import { z } from "zod";
import { isValidCnpj } from "@/lib/cnpj";

export const PROFESSIONAL_REGISTRATION_TYPE_VALUES = ["CRQ", "CREA"] as const;

export const companySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa."),
  cnpj: z.string().trim().refine(isValidCnpj, "CNPJ inválido."),
  email: z.string().trim().email("E-mail inválido."),
  addressStreet: z.string().trim().optional().nullable(),
  addressNumber: z.string().trim().optional().nullable(),
  addressComplement: z.string().trim().optional().nullable(),
  addressDistrict: z.string().trim().optional().nullable(),
  addressCity: z.string().trim().optional().nullable(),
  addressState: z.string().trim().max(2).optional().nullable(),
  addressZipCode: z.string().trim().optional().nullable(),

  // Dados bancários (opcionais) — usados automaticamente na proposta quando
  // a forma de pagamento escolhida for Depósito/PIX.
  bankName: z.string().trim().optional().nullable(),
  bankAgency: z.string().trim().optional().nullable(),
  bankAccount: z.string().trim().optional().nullable(),
  bankAccountType: z.string().trim().optional().nullable(),
  bankPixKey: z.string().trim().optional().nullable(),

  // Registro profissional — completamente opcional.
  professionalRegistrationType: z.enum(PROFESSIONAL_REGISTRATION_TYPE_VALUES).optional().nullable(),
  professionalRegistrationNumber: z.string().trim().optional().nullable(),
});

export type CompanyInput = z.infer<typeof companySchema>;
