"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/me"
  const [mode, setMode] = useState<"login" | "register" | "verify">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [otp, setOtp] = useState("")
  const [message, setMessage] = useState("")
  const [wechatMessage, setWechatMessage] = useState("")
  const [pending, setPending] = useState(false)

  function wechat() {
    setWechatMessage(
      "微信快捷登录要在微信里完成。用微信开发者工具打开小程序就能直接登录，浏览器里预览可以先用下面的邮箱。"
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage("")
    const path = mode === "register" ? "/api/auth/register" : mode === "verify" ? "/api/auth/verify" : "/api/auth/login"
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name, otp }),
    })
    const data = (await response.json().catch(() => null)) as { message?: string; needVerification?: boolean } | null
    setPending(false)
    if (data?.needVerification) {
      setMode("verify")
      setMessage("验证码已发到邮箱，填 8 位数字。")
      return
    }
    if (!response.ok) {
      setMessage(data?.message || "没有成功，再试一次。")
      return
    }
    router.push(redirect)
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="font-serif text-3xl tracking-tight">用微信登录</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        用微信一键登录。登录之后，你发的、投的、写的都记在账号里，换台设备也还在。示例不用登录也能看。
      </p>
      <Button type="button" className="mt-5 h-11 w-full" onClick={wechat}>
        微信登录
      </Button>
      {wechatMessage ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{wechatMessage}</p> : null}

      <form onSubmit={submit} className="mt-8 border-t border-dashed border-foreground/20 pt-6">
        <h2 className="text-xs tracking-[0.2em] text-muted-foreground">或者用邮箱</h2>
        <div className="mt-4 flex gap-2 text-sm">
          <button type="button" className={mode === "login" ? "underline" : "text-muted-foreground"} onClick={() => setMode("login")}>
            登录
          </button>
          <button type="button" className={mode === "register" ? "underline" : "text-muted-foreground"} onClick={() => setMode("register")}>
            注册
          </button>
        </div>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          {mode === "register" ? (
            <div className="grid gap-2">
              <Label htmlFor="name">怎么称呼你</Label>
              <Input id="name" value={name} maxLength={12} onChange={(event) => setName(event.target.value)} />
            </div>
          ) : null}
          {mode !== "verify" ? (
            <div className="grid gap-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="otp">8 位验证码</Label>
              <Input id="otp" inputMode="numeric" value={otp} maxLength={8} onChange={(event) => setOtp(event.target.value)} required />
            </div>
          )}
          {message ? <p className="text-sm text-return">{message}</p> : null}
          <Button type="submit" className="h-11" disabled={pending}>
            {pending ? "正在提交…" : mode === "register" ? "注册并进入" : mode === "verify" ? "验证并进入" : "登录"}
          </Button>
        </div>
      </form>
    </div>
  )
}
