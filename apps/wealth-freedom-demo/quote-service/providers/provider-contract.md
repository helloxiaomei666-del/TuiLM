# Quote Provider Contract

Providers run only inside `quote-service`. Do not put provider keys in `wechat-miniapp/`.

```js
provider.getQuote(
  {
    type,
    code,
    name,
    previousPrice,
    holding
  },
  {
    now
  }
)
```

Return shape:

```js
{
  code,
  name,
  assetType,
  price,
  priceTime,
  source,
  status,
  message
}
```

Rules:

- `status="ok"` means `price` can update valuation.
- `status="error"` means callers must keep the previous holding price.
- API keys must live in backend environment variables such as `QUOTE_API_KEY`.
- Real providers should add caching and rate limiting before production use.
