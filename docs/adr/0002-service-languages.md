# ADR 0002 – Service Languages

**Status:** Accepted  
**Date:** 2025-10-05  
**Context:** Each service in the _Bond Math_ project uses a different language.

---

### 🧩 What we were deciding

Should we stick to one language for everything, or split the services across multiple languages?

In a real production system, picking one language is almost always simpler — fewer toolchains, easier deployments, one skill set.  
But _Bond Math_ isn’t just about building a bond calculator.  
It’s about **showcasing Architecture as Code (AAC)** and how clear boundaries make polyglot services manageable.

---

### ⚖️ The trade-offs

| Option                               | Pros                                                                            | Cons                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Single language (Python or Node)** | Simple CI/CD, one runtime, easier testing                                       | Doesn’t really _demonstrate_ architectural separation — feels like one big app |
| **Multiple languages**               | Highlights service boundaries, shows polyglot integration, emphasizes contracts | More setup, more pipelines, not efficient in real-world ops                    |

We chose the second option — not for efficiency, but to demonstrate how AAC works across multiple runtimes.

---

### ✅ Decision

Use **three different languages** intentionally:

| Service                                     | Language                                  | Why                                                                                           |
| ------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Bond Valuation (price ↔ yield)**          | **Python**                                | Python fits financial math — concise, clear, reliable numeric behavior.                       |
| **Analytics (duration, convexity, curves)** | **Python**                                | Keeps math-heavy logic consistent.                                                            |
| **Day-Count Microservice**                  | **TypeScript / Node (Cloudflare Worker)** | Perfect for small, fast, stateless logic at the edge.                                         |
| **Pricing Engine**                          | **Java**                                  | Classic enterprise approach — stable, typed, and great for showing multi-runtime integration. |

---

### 💬 Why it works for _Bond Math_

- It **forces clean service contracts** — JSON APIs and Service Bindings make everything language-agnostic.
- It demonstrates that **Architecture as Code** isn’t tied to a language — just structure and relationships.
- It’s a perfect showcase of how IaC, code comments, and automated diagrams keep a mixed stack consistent.

---

### 🚧 Trade-offs we accept

- More CI pipelines and dependency management.
- Slightly slower dev spin-up.
- A bit of overhead to keep toolchains updated.

All worth it. This project’s purpose is to **teach and demonstrate** AAC — not to optimize for delivery speed.

---

### 📎 Outcome

The language diversity is intentional.  
It makes the _architecture_ the centerpiece of _Bond Math_ —  
showing that good boundaries and automation matter more than which language you write in.
