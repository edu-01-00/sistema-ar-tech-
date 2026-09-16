import { z } from "zod";
import { isValidCnpj } from "@/lib/cnpj";

export const clientSchema = z.object({
  cnpj: z.string().trim().refine(isValidCnpj, "CNPJ inválido."),
  corporateName: z.string().trim().min(2, "Informe a razão social."),
  tradeName: z.string().trim().optional().nullable(),
  email: z.string().trim().email("E-mail inválido.").optional().nullable().or(z.literal("")),
  phone: z.string().trim().optional().nullable(),
  addressStreet: z.string().trim().optional().nullable(),
  addressNumber: z.string().trim().optional().nullable(),
  addressComplement: z.string().trim().optional().nullable(),
  addressDistrict: z.string().trim().optional().nullable(),
  addressCity: z.string().trim().optional().nullable(),
  addressState: z.string().trim().max(2).optional().nullable(),
  addressZipCode: z.string().trim().optional().nullable(),
});

export type ClientInput = z.infer<typeof clientSchema>;

export const clientContactSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do contato."),
  email: z.string().trim().email("E-mail inválido.").optional().nullable().or(z.literal("")),
  phone: z.string().trim().optional().nullable(),
  role: z.string().trim().optional().nullable(),
});

export type ClientContactInput = z.infer<typeof clientContactSchema>;
