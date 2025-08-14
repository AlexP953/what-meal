import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6), 
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "user"]).optional().default("user")
});


export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "No hay campos para actualizar",
});