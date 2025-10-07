# ADR 0002 – Service Languages

**Status:** Accepted  
**Date:** 2025-10-05  
**Context:** Each service in the _Bond Math_ project uses a different language.

---

### 🧩 What we were deciding

Should we stick to one language for everything, or split the services across
multiple languages?

In a real production system, picking one language is almost always simpler —
fewer toolchains, easier deployments, one skill set.  
But _Bond Math_ isn’t just about building a bond calculator.  
It’s about **showcasing Architecture as Code (AAC)** and how clear boundaries
make polyglot services manageable.

---

### ⚖️ The trade-offs

| Option                               | Pros                                                                            | Cons                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Single language (Python or Node)** | Simple CI/CD, one runtime, easier testing                                       | Doesn’t really _demonstrate_ architectural separation — feels like one big app |
| **Multiple languages**               | Highlights service boundaries, shows polyglot integration, emphasizes contracts | More setup, more pipelines, not efficient in real-world ops                    |

We chose the second option — not for efficiency, but to demonstrate how AAC
works across multiple runtimes.

---

### ✅ Decision

Use **two languages** for business logic services:

| Service                                | Language                           | Why                                                                                 |
| -------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| **Gateway**                            | **TypeScript (Cloudflare Worker)** | Perfect for API routing, auth verification, and edge deployment.                    |
| **Day-Count**                          | **TypeScript (Cloudflare Worker)** | Small, fast, stateless calculations ideal for Workers runtime.                      |
| **Bond Valuation (price ↔ yield)**    | **Python (Cloudflare Worker)**     | Financial math benefits from Python's clarity and numeric reliability.              |
| **Metrics (duration, convexity)**      | **Python (Cloudflare Worker)**     | Keeps math-heavy logic consistent with valuation service.                           |
| **Pricing Engine (curve discounting)** | **Python (Cloudflare Worker)**     | Maintains language consistency; adequate performance for typical bond calculations. |

**Note on Java:** Originally considered for the pricing engine to demonstrate
multi-runtime integration, but Java is **incompatible with Cloudflare Workers**
(no JVM support). Python provides sufficient performance for bond pricing
workloads while maintaining stack simplicity.

---

### 💬 Why it works for _Bond Math_

- It **forces clean service contracts** — JSON APIs and Service Bindings make
  everything language-agnostic.
- It demonstrates that **Architecture as Code** isn’t tied to a language — just
  structure and relationships.
- It’s a perfect showcase of how IaC, code comments, and automated diagrams keep
  a mixed stack consistent.

---

### 🚧 Trade-offs we accept

- **Two language stacks** to maintain (TypeScript + Python)
- Separate CI pipelines and dependency management
- Slightly slower dev spin-up compared to single-language stacks
- Python Workers runtime constraints (no heavy frameworks like FastAPI/Django)

All worth it. This project's purpose is to **teach and demonstrate** AAC — not
to optimize for delivery speed.

### 🔄 What changed from original plan

Originally planned **Java** for the pricing engine to showcase multi-runtime
integration. However:

**Why Java doesn't work:**

- Cloudflare Workers only support JavaScript/TypeScript, Python, Rust, C, C++
  (compiled to WASM)
- No JVM support in Workers runtime
- Java would require different infrastructure (Lambda, Cloud Run, etc.)

**Why we chose Python instead:**

- Maintains consistency with other math services (valuation, metrics)
- Adequate performance for typical bond pricing (not HFT or portfolio-scale)
- Can leverage NumPy for efficient array operations if needed
- If extreme performance needed later, can rewrite hot paths in Rust→WASM
- Keeps deployment simple (all Workers, uniform infrastructure)

---

### 📎 Outcome

The language diversity is intentional.  
It makes the _architecture_ the centerpiece of _Bond Math_ —  
showing that good boundaries and automation matter more than which language you
write in.
