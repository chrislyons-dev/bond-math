# ADR 0001 – Architecture as Code

**Status:** Accepted  
**Date:** 2025-10-05  
**Context:** Project uses multiple languages and Cloudflare microservices.

---

### 🧩 What we were deciding

How to describe and maintain the architecture for a system that’s changing all the time.

We had a few options:

1. **Manual diagrams and docs** – draw diagrams in Lucidchart or Miro, and hope they stay up to date.
2. **Separate modeling tool** – use something like Structurizr Lite or C4 Studio, maintain models apart from the code.
3. **Architecture as Code** – generate diagrams and docs directly from the source code, configuration, and IaC.

---

### ⚖️ The trade-offs

| Option                   | Pros                                                  | Cons                                                          |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------- |
| **Manual diagrams**      | Quick for one-offs, looks good                        | Always out of date, hard to sync, nobody maintains them       |
| **Modeling tool**        | Structured, richer metadata                           | Another source of truth to maintain, adds friction            |
| **Architecture as Code** | Always current, lives with the repo, easy to automate | Takes a bit of setup, diagrams not as “pretty” out of the box |

We don’t want architecture diagrams that only reflect what _used to be true_.  
We’d rather have something slightly less polished but **always accurate**.

---

### ✅ Decision

We’re going with **Architecture as Code**.

- Diagrams are generated from **PlantUML / Structurizr** files committed in the repo.
- Metadata comes from comments, IaC (Terraform), and service definitions.
- GitHub Actions regenerate the diagrams automatically on each commit to `main`.
- The generated diagrams and architecture README live under `/docs/architecture`.

The goal isn’t perfect documentation — it’s **useful, honest documentation**.

---

### 💬 Notes

- We’ll keep the tone practical: what runs where, how it talks, what depends on what.
- When a developer adds or changes a service, they should update or annotate it — no heavy process.
- Over time, this becomes a habit: _code defines architecture, architecture explains code._

---

### 📎 Outcome

Everyone can open the repo and instantly see:

- What services exist
- How they connect
- How Cloudflare routes and bindings fit together
- And know the diagram was generated from real code, not from memory

That’s the whole point.
