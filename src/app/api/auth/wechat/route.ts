import { writeSession } from "@/lib/session"
import { loginWithWechatCode } from "@/lib/vectoree"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: string } | null
  const code = body?.code?.trim() || ""
  if (!code) return Response.json({ message: "没有拿到微信登录码。" }, { status: 400 })
  const result = await loginWithWechatCode(code)
  if (!result.ok) return Response.json({ message: result.message }, { status: result.status })
  await writeSession(result.tokens)
  return Response.json({ user: result.account, ...result.tokens })
}
