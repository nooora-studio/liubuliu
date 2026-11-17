import type { Account } from "@/lib/account"
import { resolveAccount } from "@/lib/session"
import { ServiceError, vectoreeConfigured } from "@/lib/vectoree"

export async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ServiceError("请求须为 JSON 对象。", 400, "INVALID_BODY")
  }
  return body
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } })
}

export function apiError(error: unknown) {
  if (error instanceof ServiceError) return json({ message: error.message, code: error.code }, error.status)
  return json({ message: "服务暂不可用，请重试。", code: "SERVICE_UNAVAILABLE" }, 503)
}

export function inputString(body: Record<string, unknown>, key: string) {
  const value = body[key]
  if (value !== undefined && typeof value !== "string") {
    throw new ServiceError(`${key} 须为字符串。`, 400, "INVALID_BODY")
  }
  return typeof value === "string" ? value : ""
}

export async function authHandle(operation: () => Promise<Response>) {
  try {
    return await operation()
  } catch (error) {
    return apiError(error)
  }
}

export async function handle(
  request: Request,
  authenticated: boolean,
  operation: (account: Account | null) => Promise<unknown>,
) {
  try {
    if (!vectoreeConfigured()) throw new ServiceError("服务器尚未配置，请稍后重试。")
    const { account, refreshed } = await resolveAccount(request)
    if (authenticated && !account) throw new ServiceError("请先登录。", 401, "AUTH_REQUIRED")
    const result = await operation(account)
    return json(refreshed && result && typeof result === "object" ? { ...result, refreshed } : result)
  } catch (error) {
    return apiError(error)
  }
}
