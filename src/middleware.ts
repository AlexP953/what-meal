export { auth as middleware } from "@/lib/auth-edge";
export const config = { matcher: ["/api/users/:path*"] };