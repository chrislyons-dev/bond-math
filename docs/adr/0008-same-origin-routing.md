# ADR 0008 – Same-Origin Routing (`/api/*` on app domain)

**Status:** Accepted
**Date:** 2025-10-05
**Context:** Decide how the SPA (Astro on Cloudflare Pages) reaches the API (Gateway Worker) without CORS headaches.

---

### 🧩 What we were deciding

I wanted the UI to call the API **without** wrestling with CORS. The cleanest way is to make the UI and API share the **same origin** (same scheme + host), and carve out an `/api/*` path that the **Gateway Worker** owns.

Options on the table:

1. **Same origin:** Serve the SPA at `bondmath.chrislyons.dev` and route `bondmath.chrislyons.dev/api/*` to the Gateway Worker.
2. **Separate API subdomain:** `api.bondmath.dev` with CORS configured.
3. **Reverse proxy on the app host:** Keep API on `api.bondmath.dev` but proxy `/api/*` from `bondmath.chrislyons.dev` to it.
4. **Pages Functions as gateway:** Implement `/api/*` inside the Pages project with service bindings.

---

### ⚖️ The trade-offs

| Option                                 | Pros                                                               | Cons                                                          |
| -------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| **Same origin (`/api/*` on app host)** | Zero CORS, simple client code (relative paths), clean mental model | Needs a Worker route on the same host; a bit of routing setup |
| **Separate API subdomain**             | Clear separation, easy DNS                                         | You own CORS forever (preflights, headers, edge cases)        |
| **Reverse proxy on app host**          | Also zero CORS; keeps an external API if needed                    | Extra hop/config, still two deployments to coordinate         |
| **Pages Functions gateway**            | Single repo/deploy; still zero CORS                                | Couples UI and gateway; less separation of concerns           |

---

### ✅ Decision

Use **same-origin routing**:

- **SPA:** `https://bondmath.chrislyons.dev` (Cloudflare Pages)
- **API:** `https://bondmath.chrislyons.dev/api/*` handled by the **Gateway Worker**
- **Internal services:** reached via **service bindings** from the Gateway Worker (not public)

This eliminates CORS entirely. The browser sees one origin; the Worker handles `/api/*`; everything else falls through to Pages.

---

### 💬 Why this makes sense for _Bond Math_

- **No CORS** = fewer headers, fewer bugs, simpler code.
- Matches the **Gateway Worker** design (ADR 0006) and the **internal JWT** pattern (ADR 0005).
- Keeps internal services private and fast via **service bindings**—no public exposure.
- Easy to document and reason about (fits the **Architecture as Code** theme).

---

### 🔧 How it’s wired (at a glance)

- **Pages custom domain:** `bondmath.chrislyons.dev`
- **Gateway Worker route (wrangler):**

  ```toml
  routes = [
    { pattern = "bondmath.chrislyons.dev/api/*", zone_name = "bondmath.dev" }
  ]
  ```

- **Client calls:** `fetch('/api/…')` with the Auth0 bearer (no absolute URLs)
- **Internal routing:** Gateway → `SVC_PRICING`, `SVC_VAL`, `SVC_DAY` (service bindings)

---

### 🚧 Trade-offs we accept

- The app and API share the same hostname, so **routing rules** must be clear; keep all API endpoints under `/api/*`.
- The Gateway Worker becomes part of the app domain’s request path — treat it as production-grade with good logging and rate limits.
- If we ever split hosting or need different cache policies per path, we’ll manage that via Worker logic and/or additional routes.

---

### 📎 Outcome

- **Calls are same origin** → no CORS.
- **`/api/*`** is consistently owned by the **Gateway Worker**.
- **Internal services** stay private behind service bindings.
- The UI uses simple relative paths and remains portable across environments.

This keeps _Bond Math_ **simple, fast, and secure** at the edge — with less boilerplate and fewer moving parts.

---

**See also:**

- [ADR 0004 – Auth0 as Identity Provider](./0004-identity-provider-auth0.md)
- [ADR 0005 – Zero-Trust Authorization](./0005-zero-trust-authorization.md)
- [ADR 0006 – Gateway Worker Design](./0006-gateway-worker.md)
