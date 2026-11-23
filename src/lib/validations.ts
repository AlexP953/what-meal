import { z } from "zod";
import { isCivilDate, mealTypes, mealReactions } from "@/shared/meal";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "user"]).optional().default("user"),
});

export const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    name: z.string().min(1).optional(),
    password: z.string().min(6).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No hay campos para actualizar",
  });

export const addMealSchema = z.object({
  name: z.string().trim().min(1),
  date: z.string().refine(isCivilDate, "Fecha civil inválida: YYYY-MM-DD"),
  type: z.enum(mealTypes),
  reaction: z.enum(mealReactions),
  place: z.string().optional(),
  notes: z.string().optional(),
});

export const updateMealSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    date: z
      .string()
      .refine(isCivilDate, "Fecha civil inválida: YYYY-MM-DD")
      .optional(),
    type: z.enum(mealTypes).optional(),
    reaction: z.enum(mealReactions).optional(),
    place: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "No hay campos para actualizar",
  });
