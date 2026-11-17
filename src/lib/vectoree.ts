import { createHash, createHmac, randomUUID } from "crypto"
import fs from "fs"
import path from "path"
import type { Account, AuthTokens } from "@/lib/account"

const API = process.env.VECTOREE_API_URL || "https://vectoree.ai"
export const LOOK_PREFIX = `${API.replace(/\/$/, "")}/api/storage/buckets/looks/objects/`

export class ServiceError extends Error {
  constructor(message: string, public status = 503, public code = "SERVICE_UNAVAILABLE") {
    super(message)
  }
}

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
  if (!key) return { ok: false, status: 503, data: { message: "暂时连不上服务器。" } }
  const headers = new Headers(init.headers)
  headers.set("accept", "application/json")
  headers.set("authorization", `Bearer ${key}`)
  if (init.body && !headers.has("content-type") && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json")
  }
  const response = await fetch(`${API.replace(/\/$/, "")}${pathname}`, { ...init, headers, cache: "no-store" }).catch(() => {
    throw new ServiceError("服务器连接失败，请重试。")
  })
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

// 走管理员接口建号：跳过公开注册的 IP 限流，并直接 autoConfirm（平台发信不可用时必须这样）。
export async function registerAccount(input: { email: string; password: string; name: string }) {
  return ve("/api/auth/admin/users?client_type=server", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      name: input.name,
      autoConfirm: true,
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
  const result = await ve("/api/auth/refresh?client_type=server", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  })
  if (result.status >= 500) throw new ServiceError("登录状态暂时无法恢复，请重试。", 503, "AUTH_UNAVAILABLE")
  return result
}

export async function currentAccount(accessToken: string) {
  const result = await ve("/api/auth/sessions/current", { userToken: accessToken })
  if (result.status >= 500) throw new ServiceError("登录状态暂时无法验证，请重试。", 503, "AUTH_UNAVAILABLE")
  return result
}

export async function rows(table: string, query = "") {
  const result = await ve(`/api/database/records/${table}${query}`)
  if (!result.ok) throw new ServiceError("数据读取失败，请重试。", 503, "DATABASE_READ_FAILED")
  if (!Array.isArray(result.data)) throw new ServiceError("服务器返回的数据格式不正确。", 502, "INVALID_DATABASE_RESPONSE")
  return result.data as unknown as Record<string, unknown>[]
}

// 即使平台限制单页大小，也继续读取到空页，不能以首屏推算统计。
export async function allRows(table: string, query = "") {
  const params = new URLSearchParams(query.replace(/^\?/, ""))
  params.delete("limit")
  params.delete("offset")
  if (!params.has("order")) params.set("order", "id.asc")
  const collected: Record<string, unknown>[] = []
  const seen = new Set<string>()
  for (;;) {
    params.set("limit", "500")
    params.set("offset", String(collected.length))
    const page = await rows(table, `?${params}`)
    if (!page.length) return collected
    for (const row of page) {
      if (typeof row.id !== "string" || seen.has(row.id)) {
        throw new ServiceError("分页数据发生变化，请刷新重试。", 503, "INCONSISTENT_PAGINATION")
      }
      seen.add(row.id)
      collected.push(row)
    }
  }
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

export async function uploadLook(bytes: Buffer, mime: string, objectKey?: string) {
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg"
  const key = objectKey || `${randomUUID()}.${ext}`
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

export async function deleteLook(url: string) {
  const prefix = LOOK_PREFIX
  if (!url.startsWith(prefix)) return
  const key = url.slice(prefix.length).split("?")[0]
  if (key) {
    const result = await ve(`/api/storage/buckets/looks/objects/${encodeURIComponent(key)}`, { method: "DELETE" })
    if (!result.ok && result.status !== 404) throw new ServiceError("照片清理失败，稍后可重试。")
  }
}

// 云端存储桶的公开读在平台侧不生效，匿名取图会 401，所以由服务端带着密钥代取。
export async function readLook(key: string) {
  const required = apiKey()
  if (!required) throw new ServiceError("暂时连不上服务器。")
  const response = await fetch(`${LOOK_PREFIX}${encodeURIComponent(key)}`, {
    headers: { authorization: `Bearer ${required}` },
    cache: "no-store",
  }).catch(() => { throw new ServiceError("照片读取失败，请重试。") })
  if (response.status === 404) return null
  if (!response.ok) throw new ServiceError("照片读取失败，请重试。")
  const bytes = Buffer.from(await response.arrayBuffer())
  return { bytes, contentType: response.headers.get("content-type") || "image/jpeg" }
}

export async function loginWithWechatCode(code: string) {
  const appid = process.env.WECHAT_APPID || ""
  const secret = process.env.WECHAT_SECRET || ""
  if (!appid || !secret) {
    return { ok: false as const, status: 501, message: "微信登录还没配好，先用邮箱试试。" }
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
    if (logged.status !== 401 && logged.status !== 404) {
      return { ok: false as const, status: logged.status >= 500 ? 503 : logged.status, message: "微信账号登录暂不可用，请重试。" }
    }
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
      return { ok: false as const, status: created.status, message: "微信身份没能关联现有 Auth。" }
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
