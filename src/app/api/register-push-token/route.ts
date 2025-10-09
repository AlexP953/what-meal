export async function POST(req: Request) {
  const { token } = await req.json();
  console.log("Nuevo token de notificación:", token);
  return new Response("Token registrado", { status: 200 });
}
