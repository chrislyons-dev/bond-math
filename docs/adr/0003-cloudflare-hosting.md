# ADR 0003 – Cloudflare Hosting

**Status:** Accepted  
**Date:** 2025-10-05  
**Context:** Choosing where to host the _Bond Math_ project.

---

### 🧩 What we were deciding

I needed to decide which platform to host _Bond Math_ on.  
My professional background is mostly in **AWS**, but this project doesn’t need
enterprise-scale complexity or cost.  
It’s a personal project focused on **Architecture as Code**, not on showing off
a full cloud stack.

The options were basically:

1. **AWS (Lambda, API Gateway, S3, CloudFront)** – what I know best.
2. **Cloudflare Pages + Workers** – simpler, cheaper, and already tied to my
   domain.
3. **Something else (Vercel, Render, Fly.io)** – all fine options, but didn’t
   add much value.

---

### ⚖️ The trade-offs

| Option         | Pros                                                      | Cons                                                             |
| -------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| **AWS**        | Familiar, powerful, scalable, enterprise-grade            | Overkill for this use case, more moving parts, higher cost       |
| **Cloudflare** | Simple, fast, global, low cost, integrates with my domain | Less flexibility for heavy compute, fewer managed services       |
| **Others**     | Easy to deploy, nice dashboards                           | Just another platform to manage, no synergy with my domain setup |

---

### ✅ Decision

Use **Cloudflare** for everything:

- **Workers** for all microservices (Python, TypeScript, Java).
- **Pages** for the Astro frontend.
- **API Gateway + Service Bindings** for routing and internal calls.
- **KV or Durable Objects** only if I need persistence later.

It’s fast, edge-deployed, and dead simple to maintain.  
For a personal project, the **time-to-deploy and cost efficiency** matter more
than deep platform flexibility.

---

### 💬 Why this makes sense for _Bond Math_

- My domain is already registered on Cloudflare — no DNS gymnastics.
- Workers fit the lightweight, stateless nature of the services.
- Pages make the UI deploy process effortless.
- The platform makes it easy to show **Architecture as Code** with Terraform and
  Wrangler, without a huge setup.
- The pricing is essentially free for this scale, which is perfect for
  experimentation.

---

### 🚧 Trade-offs we accept

- Less fine-grained IAM or VPC-level control compared to AWS.
- Limited long-running tasks (Workers are short-lived by design).
- Smaller ecosystem of managed data services.

That’s fine. None of that matters for this use case — I just need fast, reliable
hosting that doesn’t get in my way.

---

### 📎 Outcome

Cloudflare is the right fit for _Bond Math_:

- It’s simple.
- It’s affordable.
- It’s integrated with my domain.
- And it lets me focus on what I actually care about — demonstrating
  **Architecture as Code**, not wiring up yet another VPC.

If this were a commercial or enterprise system, AWS would make more sense.  
But for _Bond Math_, Cloudflare wins on **clarity, simplicity, and cost**.
