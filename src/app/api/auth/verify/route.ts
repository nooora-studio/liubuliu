import { writeSession } from "@/lib/session"
import { readAccount, readTokens, verifyEmail } from "@/lib/vectoree"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; otp?: string } | null
  const email = body?.email?.trim().toLowerCase() || ""
  const otp = body?.otp?.trim() || ""
  if (!email || !/^\d{8}$/.test(otp)) {
    return Response.json({ message: "填邮箱和 8 位验证码。" }, { status: 400 })
  }
  const result = await verifyEmail(email, otp)
  const account = readAccount(result.data)
  const tokens = readTokens(result.data)
  if (!result.ok || !account || !tokens) {
    return Response.json({ message: "验证码不对，或已经过期。" }, { status: 400 })
  }
  await writeSession(tokens)
  return Response.json({ user: account, ...tokens })
}
