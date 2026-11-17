import { writeSession } from "@/lib/session"
import { loginAccount, readAccount, readTokens } from "@/lib/vectoree"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null
  const email = body?.email?.trim().toLowerCase() || ""
  const password = body?.password || ""
  const result = await loginAccount(email, password)
  if (result.status === 403) return Response.json({ needVerification: true, email }, { status: 403 })
  const account = readAccount(result.data)
  const tokens = readTokens(result.data)
  if (!result.ok || !account || !tokens) {
    return Response.json({ message: "邮箱或密码不对。" }, { status: 401 })
  }
  await writeSession(tokens)
  return Response.json({ user: account, ...tokens })
}
