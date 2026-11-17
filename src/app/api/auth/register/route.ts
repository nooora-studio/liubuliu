import { writeSession } from "@/lib/session"
import { loginAccount, readAccount, readTokens, registerAccount } from "@/lib/vectoree"
import { authHandle, bodyOf, inputString, json } from "@/app/api/_shared"

export async function POST(request: Request) {
  return authHandle(async () => {
    const body = await bodyOf(request)
    const email = inputString(body, "email").trim().toLowerCase()
    const password = inputString(body, "password")
    const name = inputString(body, "name").trim().slice(0, 12) || "我"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ message: "邮箱看起来不对。" }, 400)
    if (password.length < 8) return json({ message: "密码至少 8 位。" }, 400)
    const result = await registerAccount({ email, password, name })
    if (result.status === 409) return json({ message: "这个邮箱已经注册过，直接登录。" }, 409)
    if (!result.ok) return json({ message: "注册没有成功，请稍后重试。" }, result.status >= 500 ? 503 : 400)
    let account = readAccount(result.data)
    let tokens = readTokens(result.data)
    if (!tokens) {
      // 沿用现有 Auth 建号方案，补登录拿齐会话，不新增账号库。
      const logged = await loginAccount(email, password)
      if (logged.status >= 500) return json({ message: "登录服务暂不可用，请重试。" }, 503)
      tokens = readTokens(logged.data)
      account = readAccount(logged.data) || account
    }
    if (!account || !tokens) return json({ needVerification: true, email })
    await writeSession(tokens)
    return json({ user: account, ...tokens })
  })
}
