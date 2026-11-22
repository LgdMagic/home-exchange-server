# F004 Living Days API

OpenSpec Change：`add-living-days`（`openspec/changes/add-living-days/`）
对应能力：`living-days`

会员侧只有一个查询接口，需要登录：请求头 `Authorization: Bearer <accessToken>`（登录接口见 F001）。

Living Days 是整数余额。首次交换权益包是另一张记录，不计入余额。一笔订单只能选用其中一样，不能在同一笔里混用。权益包未发放时是 `null`。没有购买、充值或转让接口。

开立、拒绝、取消和完成由后续交换模块在服务端调用，不提供会员 HTTP 路由。

## GET /customer/living-days

### Description

查询当前账号已结算的 Living Days 余额，以及首次交换权益包。余额不扣除尚未完成订单占用的天数，也不包含权益包。没有天数账户时余额为 0。资料未完成也可以查询。

### Authentication

Required（Bearer Access Token）

### Response

未发放权益包：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "balance": 0,
    "benefitPackage": null
  }
}
```

已发放：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "balance": 0,
    "benefitPackage": {
      "code": "FIRST_LIVING_EXCHANGE",
      "status": "AVAILABLE"
    }
  }
}
```

`benefitPackage.code` 只有 `FIRST_LIVING_EXCHANGE`。`benefitPackage.status` 只有 `AVAILABLE`（未使用）和 `USED`（已使用）。用权益包完成一笔至少 1 天的入住后变为 `USED`，客人余额不因此增加。

### Error Codes

| Code  | HTTP Status | Description                  |
| ----- | ----------- | ---------------------------- |
| 10401 | 401         | 未登录，或 Access Token 无效 |

---

## 结算错误码

下面这些码不是本查询接口返回的。后续交换接口在服务端调用结算时原样抛出。

| Code  | 名称                           | HTTP Status | Description                                                                                |
| ----- | ------------------------------ | ----------- | ------------------------------------------------------------------------------------------ |
| 22001 | BENEFIT_PACKAGE_NOT_APPLICABLE | 400         | 不能使用首次交换权益包。没有可用权益包，或所选天数不是 1 或 2                              |
| 22002 | BENEFIT_PACKAGE_ALREADY_OPEN   | 409         | 已有一笔进行中的权益包订单                                                                 |
| 22003 | INSUFFICIENT_LIVING_DAYS       | 409         | 可用 Living Days 不足。可用余额 = 已结算余额 − 该客人进行中的 Living Days 订单所选天数之和 |
| 22004 | EXCHANGE_NOT_OPEN              | 409         | 订单不在进行中，不能再次拒绝、取消或完成                                                   |
| 22005 | ACTUAL_DAYS_EXCEED_SELECTED    | 400         | 实际天数超过所选天数，或为负数                                                             |
| 21003 | PROFILE_NOT_COMPLETE           | 403         | 客人尚未完成个人资料，不能开立订单                                                         |
| 10400 | VALIDATION_ERROR               | 400         | 客人与房主是同一个账号                                                                     |

住 3 天使用 `settlementSource = LIVING_DAYS`，`selectedDays = 3`。这不读取、不修改权益包。权益包可以一直留着不用。
