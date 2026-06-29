# Quote Service

Local quote-service skeleton for the miniapp valuation flow.

It is a backend adapter boundary, not a trading service. It currently returns local mock quotes only and does not call any third-party market data API.

## Start

```powershell
node quote-service\server.js
```

Default URL:

```text
http://127.0.0.1:8010
```

Use another port:

```powershell
$env:QUOTE_SERVICE_PORT = "8011"
node quote-service\server.js
```

Use the Tushare provider locally:

```powershell
$env:QUOTE_PROVIDER_MODE = "tushare"
$env:TUSHARE_TOKEN = "<your-token>"
node quote-service\server.js
```

Do not paste the token into source files, miniapp files, screenshots, or git. `TUSHARE_TOKEN` is read only by the backend process.

Probe which Tushare valuation endpoints your account can access:

```powershell
$env:TUSHARE_TOKEN = "<your-token>"
node scripts\probe-tushare-access.js
```

The probe checks `fund_nav` and `fund_daily`, prints only endpoint status and provider messages, and never prints the token. If both endpoints report permission errors, keep the mock/local fallback enabled until the provider permission is opened or another data provider is selected.

Use the HS LIGHT provider locally after the provider authorization is confirmed:

```powershell
$env:QUOTE_PROVIDER_MODE = "hs-light"
$env:HS_LIGHT_BASE_URL = "https://sandbox.hscloud.cn"
$env:HS_LIGHT_AUTHORIZATION = "<backend-only-authorization-header>"
$env:HS_LIGHT_TRADING_DATE = "2015-12-31"
node quote-service\server.js
```

`HS_LIGHT_AUTHORIZATION` must stay in the backend process environment. Do not paste it into miniapp files, screenshots, docs, tests, or git. `HS_LIGHT_TRADING_DATE` is only a manual test override; production code should use the latest available trading day and cache by trading date.

## Endpoints

Single quote:

```text
GET /api/quotes?type=fund&code=000300
```

Batch quote:

```text
GET /api/quotes/batch?items=fund:000300,commodity:gold-demo
```

Valuation preview, without writing local snapshots:

```text
POST /api/valuations/preview
```

Request body:

```json
{
  "holdings": [],
  "now": "2026-06-13T10:00:00.000Z"
}
```

Valuation snapshot, persisted to `.runtime/valuation-snapshots.json`:

```text
POST /api/valuations/snapshot
```

Request body:

```json
{
  "userId": "demo",
  "holdings": [],
  "now": "2026-06-13T10:00:00.000Z"
}
```

Read stored snapshots:

```text
GET /api/valuations/snapshots?userId=demo
```

Response quote shape:

```json
{
  "code": "000300",
  "name": "沪深300指数基金",
  "assetType": "fund",
  "price": 1.2368,
  "priceTime": "2026-06-12T00:00:00.000Z",
  "source": "local mock quote-service",
  "status": "ok",
  "message": "本地 Demo 基金估值"
}
```

## Provider Contract

Providers live under `quote-service/providers/` and return the standard quote shape above.

- `mock-provider.js` is the default local provider.
- `real-provider-placeholder.js` only reads environment variable presence and never calls a third-party API.
- `hs-light-provider.js` maps HS LIGHT `performance/net_value` responses into standard fund quote objects.
- `tushare-provider.js` is a backend-only fund/ETF daily valuation provider skeleton.
- `provider-contract.md` documents the real provider interface.

Expected future environment variables:

```text
QUOTE_API_PROVIDER
QUOTE_API_BASE_URL
QUOTE_API_KEY
QUOTE_PROVIDER_MODE=mock|tushare|hs-light
TUSHARE_TOKEN
TUSHARE_BASE_URL
HS_LIGHT_BASE_URL
HS_LIGHT_AUTHORIZATION
HS_LIGHT_TRADING_DATE
```

Do not commit `.env`, API keys, tokens, or copied provider secrets.

## Tushare Provider Scope

The Tushare provider is for fund and ETF daily valuation only:

- Unsuffixed six-digit fund codes are sent as `.OF`, for example `000300` -> `000300.OF`.
- Suffixed exchange codes such as `510300.SH` use `fund_daily`.
- Fund NAV responses map `unit_nav` into `quote.price`.
- ETF daily responses map `close` into `quote.price`.
- Missing token, empty data, provider errors, or missing price return `status="error"` and preserve the previous price.
- Tushare permission errors are normalized to `errorCode="provider_permission_denied"` with message `数据源权限不足，已保留上次估值`.
- Tushare rate or quota errors are normalized to `errorCode="provider_rate_limited"` with message `数据源调用额度不足，已保留上次估值`.

Automated tests use fixtures and do not call Tushare. A real token is only needed for manual local verification.

## HS LIGHT Provider Scope

The HS LIGHT provider is for fund and ETF daily valuation through `聚源公募基金F10大众版 / 基金净值指标`:

- Endpoint path: `/gildatafund/v1/performance/net_value`.
- Unsuffixed six-digit fund codes are sent as `.OF`, for example `112002` -> `112002.OF`.
- Suffixed codes such as `510300.SH` are sent as provided.
- `unit_nv` maps into `quote.price`.
- `trading_date` maps into `quote.priceTime`.
- Missing authorization, empty data, provider errors, or missing `unit_nv` return `status="error"` and preserve the previous price.
- Permission errors are normalized to `errorCode="provider_permission_denied"` with message `数据源权限不足，已保留上次估值`.

Automated tests use the sandbox response fixture captured from the provider documentation page and do not call HS LIGHT.

## Future API Integration Rules

- Store third-party API keys only on the backend, preferably in environment variables or a secret manager.
- Do not write API keys into `wechat-miniapp/` files.
- Add caching and rate limiting before any real provider is connected.
- Preserve old holding prices when quote refresh fails.
- Always return `source`, `priceTime`, `status`, and `message` so the miniapp can explain the valuation state.
- Verify commercial authorization, display rights, frequency limits, and WeChat HTTPS request domain requirements before connecting a real provider.
