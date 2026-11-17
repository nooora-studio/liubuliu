import { createHash, createHmac, randomUUID } from "crypto"
import fs from "fs"
import path from "path"
import type { Account, AuthTokens } from "@/lib/account"

const API = process.env.VECTOREE_API_URL || "https://vectoree.ai"

type VeResult = {
  ok: boolean
  status: number
  data: Record<string, unknown> | null
}

function apiKey() {
  if (process.env.VECTOREE_API_KEY) return process.env.VECTOREE_API_KEY
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), ".vectoree", "config.json"), "utf8")
    const parsed = JSON.parse(raw) as { apiKey?: string }
    if (parsed.apiKey) return parsed.apiKey
  } catch {
    /* 线上环境只读密钥变量 */
  }
  return ""
}

export function vectoreeConfigured() {
  return Boolean(apiKey())
}

async function ve(pathname: string, init: RequestInit & { userToken?: string } = {}): Promise<VeResult> {
  const key = init.userToken || apiKey()
  if (!key) return { ok: false, status: 503, data: { message: "云后端还没有配置密钥。" } }
  const headers = new Headers(init.headers)
  headers.set("accept", "application/json")
  headers.set("authorization", `Bearer ${key}`)
  if (init.body && !headers.has("content-type") && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json")
  }
  const response = await fetch(`${API}${pathname}`, { ...init, headers, cache: "no-store" })
  const text = await response.text()
  let data: Record<string, unknown> | null = null
  if (text) {
    try {
      const parsed = JSON.parse(text) as unknown
      data = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : { message: text.slice(0, 300) }
    } catch {
      data = { message: text.slice(0, 300) }
    }
  }
  return { ok: response.ok, status: response.status, data }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

export function readAccount(data: Record<string, unknown> | null): Account | null {
  const user = asRecord(data?.user)
  if (!user || typeof user.id !== "string") return null
  const profile = asRecord(user.profile)
  const name = typeof profile?.name === "string" && profile.name.trim() ? profile.name.trim() : "我"
  const email = typeof user.email === "string" ? user.email : ""
  return { id: user.id, email, name: name.slice(0, 12) }
}

export function readTokens(data: Record<string, unknown> | null): AuthTokens | null {
  const accessToken = data?.accessToken
  const refreshToken = data?.refreshToken
  if (typeof accessToken !== "string" || typeof refreshToken !== "string" || !accessToken || !refreshToken) {
    return null
  }
  return { accessToken, refreshToken }
}

export async function registerAccount(input: { email: string; password: string; name: string }) {
  return ve("/api/auth/users?client_type=server", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      name: input.name,
    }),
  })
}

export async function verifyEmail(email: string, otp: string) {
  return ve("/api/auth/email/verify?client_type=server", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  })
}

export async function loginAccount(email: string, password: string) {
  return ve("/api/auth/sessions?client_type=server", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
}

export async function refreshAccount(refreshToken: string) {
  return ve("/api/auth/refresh?client_type=server", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  })
}

export async function currentAccount(accessToken: string) {
  return ve("/api/auth/sessions/current", { userToken: accessToken })
}

export async function rows(table: string, query = "") {
  const result = await ve(`/api/database/records/${table}${query}`)
  if (!result.ok || !Array.isArray(result.data)) return []
  return result.data as unknown as Record<string, unknown>[]
}

export async function insertRow(table: string, row: Record<string, unknown>) {
  return ve(`/api/database/records/${table}`, {
    method: "POST",
    body: JSON.stringify([row]),
  })
}

export async function patchRows(table: string, query: string, row: Record<string, unknown>) {
  return ve(`/api/database/records/${table}?${query}`, {
    method: "PATCH",
    body: JSON.stringify(row),
  })
}

export async function deleteRows(table: string, query: string) {
  return ve(`/api/database/records/${table}?${query}`, { method: "DELETE" })
}

export async function uploadLook(bytes: Buffer, mime: string) {
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg"
  const key = `${randomUUID()}.${ext}`
  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), key)
  const result = await ve(`/api/storage/buckets/looks/objects/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: form,
  })
  const url = result.data?.url
  if (!result.ok || typeof url !== "string") return ""
  return url
}

export async function loginWithWechatCode(code: string) {
  const appid = process.env.WECHAT_APPID || ""
  const secret = process.env.WECHAT_SECRET || ""
  if (!appid || !secret) {
    return { ok: false as const, status: 501, message: "微信登录还需要这只小程序自己的 AppID 和 AppSecret。" }
  }
  const exchange = new URL("https://api.weixin.qq.com/sns/jscode2session")
  exchange.searchParams.set("appid", appid)
  exchange.searchParams.set("secret", secret)
  exchange.searchParams.set("js_code", code)
  exchange.searchParams.set("grant_type", "authorization_code")
  const response = await fetch(exchange, { cache: "no-store" })
  const session = (await response.json()) as { openid?: string; errcode?: number; errmsg?: string }
  if (!session.openid) {
    return { ok: false as const, status: 400, message: "微信没有换到身份，请重新点一次登录。" }
  }
  const email = `${createHash("sha256").update(session.openid).digest("hex").slice(0, 24)}@wechat.liubuliu.invalid`
  const password = `${createHmac("sha256", secret).update(session.openid).digest("base64url").slice(0, 32)}Aa1`
  let logged = await loginAccount(email, password)
  if (!logged.ok) {
    const created = await ve("/api/auth/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        name: "微信用户",
        autoConfirm: true,
      }),
    })
    if (!created.ok && created.status !== 409) {
      return { ok: false as const, status: created.status, message: "微信身份没能写进账号库。" }
    }
    logged = await loginAccount(email, password)
  }
  const account = readAccount(logged.data)
  const tokens = readTokens(logged.data)
  if (!logged.ok || !account || !tokens) {
    return { ok: false as const, status: logged.status, message: "微信身份已经对上，但登录状态没有签发。" }
  }
  return { ok: true as const, account, tokens }
}
