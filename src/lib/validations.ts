import { z } from "zod";

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
  name: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD"),
  type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  reaction: z.enum(["good", "bad", "neutral"]),
  place: z.string().optional(),
  notes: z.string().optional(),
});

export const updateMealSchema = z
  .object({
    name: z.string().optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD")
      .optional(),
    type: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
    reaction: z.enum(["good", "bad", "neutral"]).optional(),
    place: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "No hay campos para actualizar",
  });
