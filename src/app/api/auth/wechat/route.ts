import { writeSession } from "@/lib/session"
import { loginWithWechatCode } from "@/lib/vectoree"
import { authHandle, bodyOf, inputString, json } from "@/app/api/_shared"

export async function POST(request: Request) {
  return authHandle(async () => {
    const body = await bodyOf(request)
    const code = inputString(body, "code").trim()
    if (!code) return json({ message: "微信没有给回登录信息，再试一次。" }, 400)
    const result = await loginWithWechatCode(code)
    if (!result.ok) return json({ message: result.message }, result.status)
    await writeSession(result.tokens)
    return json({ user: result.account, ...result.tokens })
  })
}
