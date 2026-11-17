import { writeSession } from "@/lib/session"
import { loginAccount, readAccount, readTokens, registerAccount } from "@/lib/vectoree"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string; name?: string } | null
  const email = body?.email?.trim().toLowerCase() || ""
  const password = body?.password || ""
  const name = body?.name?.trim().slice(0, 12) || "我"
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ message: "邮箱看起来不对。" }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ message: "密码至少 8 位。" }, { status: 400 })
  }
  const result = await registerAccount({ email, password, name })
  if (result.status === 409) return Response.json({ message: "这个邮箱已经注册过，直接登录。" }, { status: 409 })
  if (!result.ok) {
    const message = typeof result.data?.message === "string" ? result.data.message : "注册没有成功。"
    return Response.json({ message }, { status: result.status || 400 })
  }
  let account = readAccount(result.data)
  let tokens = readTokens(result.data)
  if (!tokens) {
    // 管理员建号只返回 accessToken，补一次登录拿齐 access + refresh
    const logged = await loginAccount(email, password)
    tokens = readTokens(logged.data)
    account = readAccount(logged.data) || account
  }
  if (!account || !tokens) {
    // 云端开启了邮箱验证：验证码已经发到邮箱，等用户填码
    return Response.json({ needVerification: true, email })
  }
  await writeSession(tokens)
  return Response.json({ user: account, ...tokens })
}
