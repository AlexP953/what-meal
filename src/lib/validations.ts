import { z } from "zod";
import { isCivilDate, mealTypes, mealReactions } from "@/shared/meal";

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const newPasswordSchema = z.string().refine(value => Array.from(value).length >= 12, "La contraseña debe contener al menos 12 caracteres")
  .refine(value => new TextEncoder().encode(value).length <= 72, "La contraseña debe ocupar como máximo 72 bytes UTF-8");
export const accountNameSchema = z.string().trim().min(1).max(100);
export const registerSchema = z.strictObject({
  email: emailSchema,
  password: newPasswordSchema,
  name: accountNameSchema.optional(),
});

export const updateUserSchema = z
  .strictObject({
    email: emailSchema.optional(),
    name: accountNameSchema.optional(),
    password: newPasswordSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No hay campos para actualizar",
  });

// https://zod.dev/api#safeextend preserves the nonempty-update refinement.
export const updateUserAdminSchema = updateUserSchema.safeExtend({ role: z.enum(["admin", "user"]).optional() });

export const addMealSchema = z.object({
  name: z.string().trim().min(1),
  date: z.string().refine(isCivilDate, "Fecha civil inválida: YYYY-MM-DD"),
  type: z.enum(mealTypes),
  reaction: z.enum(mealReactions),
  place: z.string().optional(),
  notes: z.string().optional(),
});

export const updateMealSchema = addMealSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "No hay campos para actualizar" },
);
