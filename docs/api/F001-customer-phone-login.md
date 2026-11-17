# F001 Customer Phone Login API

OpenSpec Change：`add-customer-phone-login`（`openspec/changes/add-customer-phone-login/`）
对应能力：`customer-phone-auth`

> ⚠️ **测试期说明**：`AUTH_SMS_TEST_MODE=true` 时（当前默认），验证码固定为 `999999`，不发送真实短信。
> 这是腾讯云国际短信资质审批通过前的临时状态；生产环境下该开关必须为 `false`，否则应用拒绝启动。

## POST /customer/auth/sms-code

### Description

发送手机号登录验证码。

### Consumer

Client（home-exchange-uniapp）

### Authentication

Not Required

### Permission

Public

### Request

#### Body

| Field | Type | Required | Description |
|---|---|---|---|
| countryCode | string | Yes | 区号，须在支持清单内（见下方「支持的区号」） |
| phoneNumber | string | Yes | 手机号（不含区号，纯数字） |

### Response

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "cooldownSeconds": 60
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| 20001 | 400 | 手机号格式不正确或该区号暂不支持 |
| 20002 | 429 | 60 秒内重复请求发送验证码 |
| 20003 | 429 | 同一「区号+手机号」1 小时内已发送 5 次，达到上限 |
| 10400 | 400 | 参数基础格式错误（如 phoneNumber 非 4-15 位数字） |

### Business Rules

- 验证码有效期 5 分钟。
- 同一「区号+手机号」60 秒内不可重复发送。
- 同一「区号+手机号」1 小时内最多发送 5 次。
- 测试期（`AUTH_SMS_TEST_MODE=true`）验证码固定为 `999999`，不实际发送短信。

---

## POST /customer/auth/login/sms

### Description

手机号 + 短信验证码登录。手机号已有账号则登录该账号；无账号则自动创建并登录（登录即注册）。

### Consumer

Client（home-exchange-uniapp）

### Authentication

Not Required

### Permission

Public

### Request

#### Body

| Field | Type | Required | Description |
|---|---|---|---|
| countryCode | string | Yes | 区号，须在支持清单内 |
| phoneNumber | string | Yes | 手机号（不含区号，纯数字） |
| code | string | Yes | 6 位数字验证码 |
| agreedToTerms | boolean | Yes | 是否已勾选同意《用户协议》《隐私政策》；为 `false` 时拒绝登录 |

### Response

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "accessToken": "<JWT>",
    "refreshToken": "<JWT>",
    "account": {
      "id": "uuid",
      "countryCode": "+86",
      "phoneNumber": "13800138000",
      "nickname": null,
      "avatarUrl": null,
      "isNewAccount": true
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| 20001 | 400 | 手机号格式不正确或该区号暂不支持 |
| 20004 | 400 | 验证码已过期（超过 5 分钟） |
| 20005 | 400 | 验证码错误 |
| 20006 | 400 | 验证码连续输错 5 次已失效，需重新获取 |
| 20007 | 400 | 未同意《用户协议》《隐私政策》 |

### Business Rules

- 「区号+手机号」是账号唯一标识；同一组合无论通过哪种方式登录，始终对应同一账号。
- 不同区号下数字相同的手机号视为不同账号。
- 新手机号首次登录即自动创建账号，直接返回登录态，不强制要求补全昵称/头像。
- `accessToken` 有效期 `JWT_ACCESS_TOKEN_TTL`（默认 15m），`refreshToken` 有效期 `JWT_REFRESH_TOKEN_TTL`（默认 30d）；均为无状态 JWT，当前不支持服务端主动吊销。

---

## POST /customer/auth/login/wechat-phone

### Description

微信一键获取手机号登录。小程序端通过 `wx.getPhoneNumber` 拿到 `code` 后传给本接口，服务端换取真实手机号完成登录/注册。

### Consumer

Client（home-exchange-uniapp，微信小程序）

### Authentication

Not Required

### Permission

Public

### Request

#### Body

| Field | Type | Required | Description |
|---|---|---|---|
| code | string | Yes | `wx.getPhoneNumber` 回调返回的 `code`，一次性、短时效 |
| agreedToTerms | boolean | Yes | 是否已勾选同意《用户协议》《隐私政策》；为 `false` 时拒绝登录 |

### Response

与 `POST /customer/auth/login/sms` 相同结构（见上）。`account.countryCode` 取自微信返回的区号。

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| 20007 | 400 | 未同意《用户协议》《隐私政策》 |
| 20008 | 400 | 微信侧 code 换手机号失败（code 无效/过期，或微信接口异常） |

### Business Rules

- 与「手机号+验证码」登录共用同一套账号唯一性与登录/注册逻辑。
- 微信返回的区号直接使用，不受「支持的区号」清单限制（见 spec.md「微信返回的手机号自带区号信息」场景）。
- AppID/AppSecret 仅存在于服务端环境变量，小程序端不会接触到。

---

## 支持的区号

| 区号 | 地区 |
|---|---|
| +86 | 中国大陆（默认） |
| +852 | 中国香港 |
| +853 | 中国澳门 |
| +886 | 中国台湾 |
| +1 | 美国/加拿大 |
| +65 | 新加坡 |
| +61 | 澳大利亚 |
| +44 | 英国 |
| +81 | 日本 |
| +82 | 韩国 |

具体号码格式校验规则见 `src/modules/auth/constants/supported-regions.ts`（工程近似值，上线前需进一步核对，见 design.md Risks 第 1 条）。
