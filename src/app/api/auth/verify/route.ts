import { writeSession } from "@/lib/session"
import { readAccount, readTokens, verifyEmail } from "@/lib/vectoree"
import { authHandle, bodyOf, inputString, json } from "@/app/api/_shared"

export async function POST(request: Request) {
  return authHandle(async () => {
    const body = await bodyOf(request)
    const email = inputString(body, "email").trim().toLowerCase()
    const otp = inputString(body, "otp").trim()
    if (!email || !/^\d{8}$/.test(otp)) return json({ message: "填邮箱和 8 位验证码。" }, 400)
    const result = await verifyEmail(email, otp)
    if (result.status >= 500) return json({ message: "验证服务暂不可用，请重试。" }, 503)
    const account = readAccount(result.data)
    const tokens = readTokens(result.data)
    if (!result.ok || !account || !tokens) return json({ message: "验证码不对，或已经过期。" }, 400)
    await writeSession(tokens)
    return json({ user: account, ...tokens })
  })
}
