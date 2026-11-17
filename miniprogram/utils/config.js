// 正式部署后填写合法 HTTPS 域名；未配置时明确阻止请求。
const PRODUCTION_API_BASE = ""
const DEVELOP_API_BASE = "http://127.0.0.1:4261"

function getApiBase() {
  let env = ""
  try {
    env = wx.getAccountInfoSync().miniProgram.envVersion
  } catch (error) {}
  const base = env === "develop" ? DEVELOP_API_BASE : PRODUCTION_API_BASE
  if (!base) throw new Error("尚未配置正式 HTTPS API 域名，请联系开发者。")
  if (!/^https:\/\/[^/]+/.test(base) &&
      !(env === "develop" && /^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(base))) {
    throw new Error("API 配置无效：正式环境必须使用 HTTPS。")
  }
  return base.replace(/\/$/, "")
}

module.exports = { getApiBase }
