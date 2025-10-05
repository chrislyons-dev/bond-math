# Contributing to Bond Math

Thank you for your interest in contributing to **Bond Math**! This document outlines the standards and conventions for contributing to this project.

---

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Commit Message Standards](#commit-message-standards)
- [Branch Naming](#branch-naming)
- [Pull Request Process](#pull-request-process)
- [Code Review Guidelines](#code-review-guidelines)
- [Architecture as Code](#architecture-as-code)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (for TypeScript services and Wrangler)
- **Python** 3.11+ (for valuation and metrics services)
- **Java** 17+ (for pricing engine)
- **Terraform** 1.5+ (for infrastructure)
- **Wrangler CLI** (Cloudflare Workers deployment)

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/chrislyons-dev/bond-math.git
cd bond-math

# Install root dependencies (if any)
npm install

# Set up each service (see service-specific READMEs)
cd services/gateway && npm install
cd ../daycount && npm install
# etc.
```

---

## 📝 Commit Message Standards

We follow **Conventional Commits** with some Bond Math-specific conventions.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

Must be one of:

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **build**: Changes to build system or dependencies
- **ci**: Changes to CI/CD configuration
- **chore**: Other changes that don't modify src or test files
- **arch**: Architecture changes (diagrams, ADRs, metadata)

### Scope

The scope should identify which part of the system is affected:

**Services:**
- `gateway` – Gateway Worker
- `daycount` – Day-Count service
- `valuation` – Bond Valuation service
- `metrics` – Metrics service
- `pricing` – Pricing Engine

**Infrastructure:**
- `iac` – Infrastructure as Code (Terraform, Wrangler)
- `deploy` – Deployment scripts and configuration

**Cross-cutting:**
- `auth` – Authentication and authorization
- `docs` – Documentation
- `testing` – Test infrastructure
- `api` – API contracts and schemas

**Examples:**
```
feat(daycount): add ACT/ACT ICMA convention support
fix(gateway): correct internal JWT expiration validation
docs(adr): add ADR for caching strategy
arch(gateway): update component diagram with new routes
refactor(valuation): extract schedule generation to separate module
test(integration): add end-to-end pricing flow tests
ci(deploy): parallelize Worker deployments
```

### Subject

- Use **imperative mood** ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Limit to **50 characters**

### Body

- Wrap at **72 characters**
- Explain **what and why**, not how
- Reference issues and ADRs when relevant

### Footer

- Reference breaking changes: `BREAKING CHANGE: <description>`
- Reference issues: `Fixes #123`, `Closes #456`, `Ref #789`
- Reference ADRs: `ADR: 0010`

### Examples

#### Simple feature
```
feat(daycount): add 30/360 ISDA convention

Implements the ISDA variant of 30/360 day count convention
to support certain corporate bond calculations.

ADR: 0007
```

#### Bug fix with context
```
fix(gateway): prevent token replay attacks

Added nonce validation to internal JWT verification.
Tokens with duplicate nonces within the TTL window
are now rejected with 401 Unauthorized.

The attack vector was discovered during security review
of the zero-trust authorization flow.

Fixes #42
ADR: 0005
```

#### Breaking change
```
feat(api)!: standardize error response format

BREAKING CHANGE: All API errors now return RFC 7807
Problem Details format instead of custom error objects.

Before:
{
  "error": "Invalid input",
  "code": "VALIDATION_ERROR"
}

After:
{
  "type": "https://bondmath.dev/errors/validation",
  "title": "Invalid Input",
  "status": 400,
  "detail": "The 'convention' field is required"
}

Clients must update error handling logic.

Ref #67
```

#### Architecture change
```
arch(gateway): document service binding flow

Added C4 component diagram showing how Gateway Worker
uses service bindings to route requests to internal services.

Updated metadata annotations in gateway/src/index.ts
to reflect current dependencies.

ADR: 0010
```

---

## 🌿 Branch Naming

Use descriptive branch names with the following format:

```
<type>/<short-description>
```

**Types:**
- `feature/` – New features
- `fix/` – Bug fixes
- `docs/` – Documentation updates
- `refactor/` – Code refactoring
- `test/` – Test additions or updates
- `chore/` – Maintenance tasks

**Examples:**
```
feature/act-act-icma-convention
fix/gateway-token-validation
docs/update-deployment-guide
refactor/extract-jwt-utils
test/add-daycount-integration-tests
chore/upgrade-wrangler-cli
```

---

## 🔄 Pull Request Process

### Before Opening a PR

1. **Ensure all tests pass locally**
   ```bash
   make test
   ```

2. **Update Architecture as Code metadata** if you changed service behavior
   - Add/update `@service`, `@endpoint`, `@calls` annotations
   - Regenerate diagrams: `make arch-docs`

3. **Update relevant documentation**
   - Service README if public API changed
   - ADR if architectural decision was made
   - Reference docs in `/docs/reference/`

4. **Run linting and formatting**
   ```bash
   make lint
   make format
   ```

### PR Title

Use the same format as commit messages:
```
feat(daycount): add ACT/ACT ICMA convention
```

### PR Description Template

```markdown
## Summary
Brief description of what this PR does.

## Changes
- Bullet point list of changes
- Keep it concise

## Testing
How was this tested?
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manually tested in local Wrangler dev environment
- [ ] Deployed to preview environment

## Architecture Impact
- [ ] No architecture changes
- [ ] Updated service metadata annotations
- [ ] Added/updated C4 diagrams
- [ ] Created new ADR

## Breaking Changes
- [ ] No breaking changes
- [ ] Breaking changes documented below

## Checklist
- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] Commit messages follow standards
- [ ] Architecture metadata updated (if applicable)

## Related Issues
Fixes #123
Ref ADR-0010
```

### Review Process

- PRs require **at least one approval** before merging
- CI must pass (tests, linting, diagram generation)
- Address all review comments or explain why changes aren't needed
- Keep PRs **focused and reasonably sized** (< 500 lines ideal)

---

## 👀 Code Review Guidelines

### For Reviewers

**Focus on:**
- ✅ Correctness and edge cases
- ✅ Security implications (especially auth/authz flows)
- ✅ Adherence to zero-trust model
- ✅ Architecture as Code metadata accuracy
- ✅ Test coverage for critical paths
- ✅ Clear error messages and logging
- ✅ Performance implications (especially for edge Workers)

**Don't bikeshed:**
- ❌ Code style (handled by automated formatters)
- ❌ Minor naming preferences (unless truly confusing)

**Be kind:**
- Phrase feedback as questions when appropriate
- Acknowledge good solutions
- Explain the "why" behind suggestions

### For Authors

- Respond to all comments (even if just "acknowledged")
- Don't take feedback personally
- Ask for clarification if needed
- Mark conversations as resolved once addressed

---

## 🏗️ Architecture as Code

Any change that affects architecture **must** update metadata annotations.

### When to Update Metadata

- **Always:**
  - Adding a new service
  - Adding a new API endpoint
  - Changing service dependencies
  - Modifying authentication/authorization

- **Consider:**
  - Changing error handling significantly
  - Adding caching
  - Changing rate limits
  - Updating SLA requirements

### How to Update

1. **Update annotations** in the source code (see ADR-0010)
2. **Regenerate diagrams** locally:
   ```bash
   make arch-docs
   ```
3. **Review generated diagrams** to ensure accuracy
4. **Commit both code and diagram changes** in the same PR

### Creating a New ADR

When making a significant architectural decision:

1. Copy the ADR template:
   ```bash
   cp docs/adr/TEMPLATE.md docs/adr/XXXX-your-decision.md
   ```

2. Fill in all sections:
   - Context: What decision needs to be made and why
   - Options: At least 2-3 alternatives considered
   - Decision: What was chosen
   - Trade-offs: Honest assessment of pros/cons
   - Outcome: Expected impact

3. Use a conversational but professional tone (see existing ADRs)

4. Get feedback before marking as "Accepted"

---

## 📐 Service-Specific Guidelines

### TypeScript (Gateway, Day-Count)

- Follow [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- Use strict TypeScript (`strict: true`)
- Prefer `const` over `let`
- Avoid `any` – use `unknown` if type is truly unknown
- Document all public APIs with JSDoc

### Python (Valuation, Metrics)

- Follow [PEP 8](https://peps.python.org/pep-0008/)
- Use type hints (PEP 484)
- Maximum line length: 88 characters (Black default)
- Use `ruff` for linting
- Document all public functions with docstrings (Google style)

### Java (Pricing Engine)

- Follow [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html)
- Use Java 17 features
- Prefer immutability
- Document all public APIs with Javadoc

---

## 🧪 Testing Standards

### Required Test Coverage

- **Unit tests:** All business logic functions
- **Integration tests:** Service-to-service interactions
- **Contract tests:** API request/response formats
- **Security tests:** Auth/authz paths

### Test Naming

Use descriptive test names that read like specifications:

**Good:**
```typescript
test('returns 401 when Auth0 token is expired')
test('mints internal JWT with correct actor claim')
test('calculates ACT/360 year fraction correctly for leap year')
```

**Bad:**
```typescript
test('test1')
test('auth fails')
test('calculation')
```

### Test Organization

```
tests/
├── unit/
│   ├── gateway/
│   ├── daycount/
│   └── ...
├── integration/
│   ├── gateway-to-daycount.test.ts
│   └── ...
└── load/
    └── ...
```

---

## 🚢 Release Process

(To be defined as project matures)

For now:
- Merges to `main` auto-deploy to production via GitHub Actions
- Use feature flags for incomplete features
- Maintain backward compatibility or clearly document breaking changes

---

## 📞 Getting Help

- **GitHub Discussions:** For general questions
- **GitHub Issues:** For bugs and feature requests
- **Slack/Discord:** (If/when established)

---

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to Bond Math!** 🎉

Your work helps demonstrate that clean architecture, strong conventions, and Architecture as Code principles can make distributed systems understandable and maintainable.
