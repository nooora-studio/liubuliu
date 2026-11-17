import { writeSession } from "@/lib/session"
import { loginAccount, readAccount, readTokens } from "@/lib/vectoree"
import { authHandle, bodyOf, inputString, json } from "@/app/api/_shared"

export async function POST(request: Request) {
  return authHandle(async () => {
    const body = await bodyOf(request)
    const email = inputString(body, "email").trim().toLowerCase()
    const password = inputString(body, "password")
    const result = await loginAccount(email, password)
    if (result.status >= 500) return json({ message: "登录服务暂不可用，请重试。" }, 503)
    if (result.status === 403) return json({ needVerification: true, email }, 403)
    const account = readAccount(result.data)
    const tokens = readTokens(result.data)
    if (!result.ok || !account || !tokens) return json({ message: "邮箱或密码不对。" }, 401)
    await writeSession(tokens)
    return json({ user: account, ...tokens })
  })
}
