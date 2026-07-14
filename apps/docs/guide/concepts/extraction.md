# Tenant extraction

Extraction answers one question per request: **which tenant is this?** Tenantry ships three built-in strategies plus a custom escape hatch. Configure exactly one in `TenancyModule.forRoot()`.

## Header

```ts
TenancyModule.forRoot({
  extraction: { strategy: 'header', header: 'x-tenant-id' }, // header defaults to x-tenant-id
});
```

Simplest to test (`curl -H "x-tenant-id: acme" …`) and a good fit behind an API gateway that injects the header after authentication. Multi-value headers use the first value; blank values count as absent.

::: warning
Only use header extraction when the header is set by infrastructure you trust (gateway, BFF). A header set by the end user is a tenant _claim_, not a tenant _proof_ — combine it with authorization checks, or rely on RLS to make spoofing pointless: an attacker who claims tenant B still only reaches rows the policy allows for tenant B, which your authorization layer should prevent from ever happening.
:::

## JWT claim

```ts
TenancyModule.forRoot({
  extraction: { strategy: 'jwt', claim: 'tenantId', header: 'authorization' },
});
```

Reads `Authorization: Bearer <token>`, decodes the payload, and returns the claim.

::: danger The token is NOT verified
This strategy **decodes** the JWT; it does not check the signature. Signature verification is your authentication layer's job (Passport, `@nestjs/jwt`, an API gateway) and must happen before the claim is trusted. Tenantry deliberately avoids duplicating auth — running extraction after your auth middleware/guard is the intended setup.
:::

Malformed tokens, non-Bearer schemes, non-object payloads, and missing or non-string claims all resolve to _no tenant_ — never an exception.

## Subdomain

```ts
TenancyModule.forRoot({
  extraction: { strategy: 'subdomain', baseDomain: 'example.com' },
});
```

`acme.example.com` → `acme`. Strict on purpose: the bare base domain, unrelated hosts (`evil-example.com`), and **nested subdomains** (`a.b.example.com`) all resolve to no tenant, so nothing unexpected can be smuggled through DNS labels. Ports are stripped and hosts lowercased.

## Custom

```ts
TenancyModule.forRoot({
  extraction: {
    strategy: 'custom',
    extractor: async (req) => {
      const apiKey = req.headers['x-api-key'];
      return typeof apiKey === 'string' ? lookupTenantByApiKey(apiKey) : null;
    },
  },
});
```

The callback receives a framework-agnostic `RequestLike` (`headers`, optional `hostname`) and may return a string, `null`/`undefined`, or a promise of either. Results are trimmed; empty strings count as absent.

## What happens when extraction fails?

Nothing dramatic — and that's deliberate. The middleware opens an **empty context** and lets `TenancyGuard` reject the request (403 by default, customizable via `guard.exceptionFactory`). Routes marked `@Public()` pass through. This separation keeps extractors simple and centralizes the rejection policy in one place.
