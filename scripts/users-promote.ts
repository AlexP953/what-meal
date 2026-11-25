import { parseArgs } from "node:util";
import mongoose from "mongoose";
import { dbConnect } from "../src/server/persistence/connection";
import { User } from "../src/server/persistence/user";
import { emailSchema } from "../src/lib/validations";

async function main() {
  try {
    let email: string | undefined;
    try { email = parseArgs({ options: { email: { type: "string" } }, strict: true, allowPositionals: false }).values.email; }
    catch { /* Invalid arguments produce the same safe usage message. */ }
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      console.error("Indica un correo válido: npm run users:promote -- --email <correo>");
      process.exitCode = 1;
      return;
    }
    await dbConnect();
    const result = await User.updateOne({ email: parsed.data }, { $set: { role: "admin" } }, { runValidators: true, timestamps: false });
    if (result.matchedCount !== 1) {
      console.error("No existe una cuenta con ese correo.");
      process.exitCode = 1;
      return;
    }
    console.log("Cuenta promovida a admin.");
  } catch {
    console.error("No se pudo promover la cuenta. Comprueba MONGODB_URI, MONGODB_DB y la conexión de MongoDB.");
    process.exitCode = 1;
  } finally {
    try { await mongoose.disconnect(); }
    catch { console.error("No se pudo cerrar la conexión de MongoDB."); process.exitCode = 1; }
  }
}
void main();
