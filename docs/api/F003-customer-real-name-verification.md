# F003 Customer Real Name Verification API

OpenSpec Change：`add-customer-real-name-verification`（`openspec/changes/add-customer-real-name-verification/`）
对应能力：`customer-real-name-verification`

**全部接口都需要登录**：请求头 `Authorization: Bearer <accessToken>`（登录接口见 F001）。

本期做姓名、大陆 18 位身份证号，以及身份证人像面、国徽面。不调用第三方核验，也不把照片送检。提交成功后状态是 `PENDING`（待核验）。任何接口都不返回「已实名认证」。身份证号和证件照片都用 AES-256-GCM 加密存储。响应里不出现身份证号明文或密文，也不出现照片内容和文件地址。

## GET /customer/real-name-verification

### Description

查询当前账号是否已经提交实名信息。登录后、以及「我的」和换房页的资料入口，用 `submitted` 决定先进实名页还是资料编辑。

### Authentication

Required（Bearer Access Token）

### Response

未提交：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "submitted": false,
    "status": null,
    "realName": null,
    "birthDate": null,
    "idCardFrontUploaded": false,
    "idCardBackUploaded": false
  }
}
```

已提交：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "submitted": true,
    "status": "PENDING",
    "realName": "张*",
    "birthDate": "1996-08-15T00:00:00.000Z",
    "idCardFrontUploaded": true,
    "idCardBackUploaded": true
  }
}
```

`status` 只有 `null` 和 `PENDING`。`realName` 是脱敏值。`birthDate` 从身份证号第 7–14 位解析。`idCardFrontUploaded` 是人像面，`idCardBackUploaded` 是国徽面。未提交时也可以是 `true`，表示这一面已经传过、还可以更换。

---

## POST /customer/real-name-verification/id-card-photo

### Description

上传身份证人像面或国徽面。同一面在提交实名信息之前再次上传会覆盖。已提交实名信息后不能再上传。照片加密后存在服务器本地，响应不返回文件地址。

### Authentication

Required（Bearer Access Token）

### Request

`multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| file | file | Yes | JPG 或 PNG，按文件头识别。单张不超过 5MB |
| side | string | Yes | `FRONT` 人像面，`BACK` 国徽面 |

### Response

```json
{
  "code": 0,
  "message": "success",
  "data": { "uploaded": true }
}
```

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| 21007 | 409 | 实名信息已提交，不能再上传或更换照片 |
| 21009 | 400 / 413 | 不是 JPG/PNG，或超过 5MB。超过 5MB 时 HTTP 状态是 413 |
| 10400 | 400 | `side` 不是 `FRONT` 或 `BACK`，或没有文件 |

---

## POST /customer/real-name-verification

### Description

首次提交姓名和大陆身份证号。人像面和国徽面必须已经上传。通过基本校验后写入待核验记录，两张照片随记录锁定。同一账号再次提交会被拒绝，已保存的姓名、身份证号、出生日期和照片保持不变。同一个身份证号只能绑定一个账号。

### Request

| Field | Type | Required | Description |
|---|---|---|---|
| realName | string | Yes | 去掉首尾空格后 1–30 个字符。纯空格拒绝 |
| idCardNumber | string | Yes | 18 位大陆身份证号。末位可以是数字或 `x`/`X`，按大写参与校验和存储 |

### Response

```json
{
  "code": 0,
  "message": "success",
  "data": { "success": true }
}
```

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| 10400 | 400 | 姓名为空，或身份证号长度不是 18 位 |
| 21005 | 400 | 身份证号校验位错误，或其中的出生日期不存在、晚于当天 |
| 21006 | 409 | 该身份证号已被其他账号使用。响应不包含对方账号的任何信息 |
| 21007 | 409 | 当前账号已经提交过，不能修改或再次提交 |
| 21008 | 400 | 人像面或国徽面还没上传。`message` 会指出缺的是哪一面 |

---

## 错误码

| Code | 名称 |
|---|---|
| 21004 | REAL_NAME_NOT_SUBMITTED（资料第一步使用，见 F002） |
| 21005 | ID_CARD_NUMBER_INVALID |
| 21006 | ID_CARD_ALREADY_BOUND |
| 21007 | REAL_NAME_LOCKED |
| 21008 | ID_CARD_PHOTOS_REQUIRED |
| 21009 | ID_CARD_PHOTO_INVALID |
