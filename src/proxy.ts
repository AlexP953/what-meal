export { auth as proxy } from "@/lib/auth-edge";
export const config = { matcher: ["/api/users/:path*"] };