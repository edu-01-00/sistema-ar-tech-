import { z } from "zod";
import { isValidCpf } from "@/lib/cpf";

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do funcionário."),
  cpf: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((value) => !value || isValidCpf(value), "CPF inválido."),
  email: z.string().trim().email("E-mail inválido.").optional().nullable().or(z.literal("")),
  phone: z.string().trim().optional().nullable(),
  position: z.string().trim().optional().nullable(),
  hiredAt: z.string().trim().optional().nullable(),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;

export const createEmployeeUserSchema = z.object({
  email: z.string().trim().email("E-mail inválido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
  roleId: z.string().min(1, "Selecione um nível de acesso."),
});

export const updateEmployeeUserSchema = z.object({
  roleId: z.string().min(1, "Selecione um nível de acesso.").optional(),
  active: z.boolean().optional(),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres.").optional(),
});

export const epiOrderSchema = z.object({
  employeeId: z.string().min(1, "Selecione o funcionário."),
  epiIds: z.array(z.string()).min(1, "Selecione ao menos um EPI."),
});

export const epiOrderAcceptSchema = z.object({
  acceptedName: z.string().trim().min(2, "Informe o nome completo para confirmar o aceite."),
});
