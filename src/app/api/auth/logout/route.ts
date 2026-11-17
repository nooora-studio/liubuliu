import { clearSession } from "@/lib/session"
import { authHandle, json } from "@/app/api/_shared"

export async function POST() {
  return authHandle(async () => {
    await clearSession()
    return json({ ok: true })
  })
}
