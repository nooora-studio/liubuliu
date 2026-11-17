import { cookies } from "next/headers"
import type { Account, AuthTokens } from "@/lib/account"
import { currentAccount, readAccount, refreshAccount } from "@/lib/vectoree"

const ACCESS = "liubuliu_access"
const REFRESH = "liubuliu_refresh"

function cookieBase() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  }
}

export async function writeSession(tokens: AuthTokens) {
  const jar = await cookies()
  jar.set(ACCESS, tokens.accessToken, { ...cookieBase(), maxAge: 60 * 60 })
  jar.set(REFRESH, tokens.refreshToken, { ...cookieBase(), maxAge: 60 * 60 * 24 * 30 })
}

export async function clearSession() {
  const jar = await cookies()
  jar.delete(ACCESS)
  jar.delete(REFRESH)
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") || ""
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : ""
}

export async function resolveAccount(request: Request): Promise<{
  account: Account | null
  refreshed: AuthTokens | null
}> {
  const jar = await cookies()
  const access = bearer(request) || jar.get(ACCESS)?.value || ""
  const refresh = request.headers.get("x-refresh-token") || jar.get(REFRESH)?.value || ""
  if (access) {
    const current = await currentAccount(access)
    const account = readAccount(current.data)
    if (account) return { account, refreshed: null }
  }
  if (!refresh) return { account: null, refreshed: null }
  const next = await refreshAccount(refresh)
  const account = readAccount(next.data)
  const accessToken = next.data?.accessToken
  const refreshToken = next.data?.refreshToken
  if (!next.ok || !account || typeof accessToken !== "string" || typeof refreshToken !== "string") {
    return { account: null, refreshed: null }
  }
  const refreshed = { accessToken, refreshToken }
  if (!bearer(request)) await writeSession(refreshed)
  return { account, refreshed }
}
