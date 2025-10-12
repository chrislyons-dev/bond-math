# Local Development Guide

This guide explains how to run the entire Bond Math stack locally using Wrangler
(Miniflare).

## Prerequisites

- Node.js 18+
- Python 3.11+
- Wrangler 3.x (installed via npm workspaces)
- Auth0 account (optional, only needed for authentication testing)

## TL;DR - Fastest Way to Start

```bash
# 1. Create secrets file (first time only)
cp iac/workers/.dev.vars.example iac/workers/.dev.vars
# (Already done! JWT secret has been generated)

# 2. Start everything
npm run dev:stack

# 3. Test it
curl http://localhost:8787/health  # Day-Count
curl http://localhost:8791/health  # Gateway
```

## Quick Start

### 1. Initial Setup (One-time)

```bash
# Install all dependencies
npm install

# Install Python dependencies for each service
cd services/bond-valuation && py -3 -m pip install -e ".[dev]" && cd ../..
cd services/metrics && py -3 -m pip install -e ".[dev]" && cd ../..
cd services/pricing && py -3 -m pip install -e ".[dev]" && cd ../..

# Install microapi library (if not already installed)
cd libs/microapi && py -3 -m pip install -e ".[dev]" && cd ../..
```

### 2. Configure Secrets

The secrets file has been created at `iac/workers/.dev.vars` with a generated
JWT secret.

**For Auth0 testing (optional):** Edit `iac/workers/.dev.vars` and update:

- `AUTH0_DOMAIN` - Your Auth0 tenant domain
- `AUTH0_AUDIENCE` - Your API identifier

**Without Auth0:** The services will run without authentication. The Gateway
will log warnings but continue operating.

### 3. Start Services

**Option A: Use Helper Script (Recommended)**

```bash
# Windows (PowerShell)
npm run dev:stack

# Linux/Mac/WSL
npm run dev:stack:bash
```

This will automatically start all services in separate terminal windows.

**Option B: Manual Start**

You need to run each service in a **separate terminal window** in this order:

#### Terminal 1: Day-Count Service

```bash
cd services/daycount
npm run dev
# Runs on http://localhost:8787 by default
```

#### Terminal 2: Bond Valuation Service

```bash
cd services/bond-valuation
wrangler dev --config ../../iac/workers/valuation.toml --port 8788
# Runs on http://localhost:8788
```

#### Terminal 3: Metrics Service

```bash
cd services/metrics
wrangler dev --config ../../iac/workers/metrics.toml --port 8789
# Runs on http://localhost:8789
```

#### Terminal 4: Pricing Service

```bash
cd services/pricing
wrangler dev --config ../../iac/workers/pricing.toml --port 8790
# Runs on http://localhost:8790
```

#### Terminal 5: Gateway

```bash
cd services/gateway
npm run dev
# Runs on http://localhost:8787
# Note: This will conflict with day-count if both use same port
# You may need to adjust ports in wrangler.toml files
```

#### Terminal 6: UI (optional)

```bash
cd ui
npm run dev
# Runs on http://localhost:4321
```

## Service Ports

Each service needs its own port for local development:

| Service        | Port | URL                   |
| -------------- | ---- | --------------------- |
| Day-Count      | 8787 | http://localhost:8787 |
| Bond Valuation | 8788 | http://localhost:8788 |
| Metrics        | 8789 | http://localhost:8789 |
| Pricing        | 8790 | http://localhost:8790 |
| Gateway        | 8791 | http://localhost:8791 |
| UI             | 4321 | http://localhost:4321 |

## API Proxy Configuration

The UI is configured to automatically proxy API requests to the local Gateway:

- **UI runs on**: `http://localhost:4321`
- **Requests to**: `http://localhost:4321/api/*`
- **Proxied to**: `http://localhost:8791/api/*` (Gateway)

This is configured in `ui/astro.config.mjs` using Vite's proxy feature. When you
make API calls from the UI (e.g., via `calculateDayCount()`), they automatically
go through the proxy to the Gateway without CORS issues.

**How it works:**

1. UI code calls: `fetch('/api/daycount/v1/count', ...)`
2. Vite dev server intercepts and proxies to:
   `http://localhost:8791/api/daycount/v1/count`
3. Gateway processes request and forwards to Day-Count service
4. Response returns through proxy back to UI

**Note:** The proxy only works in development (`npm run dev`). In production,
the UI and API are served from the same domain, so no proxy is needed.

## Important Notes on Service Bindings

### Local Development Limitations

Service Bindings in `wrangler dev` have some limitations:

1. **Local-to-Local Bindings**: Recent versions of Wrangler support local
   service bindings, but they must all be running simultaneously
2. **Port Configuration**: Each service needs a unique port
3. **Binding Resolution**: The Gateway's service bindings will try to connect to
   local instances

### Testing Without Full Stack

You can test individual services directly:

```bash
# Test Day-Count directly
curl http://localhost:8787/health

# Test Bond Valuation directly
curl http://localhost:8788/health

# Test with the Day-Count service
cd services/daycount
npm run dev

curl -X POST http://localhost:8787/api/daycount/v1/count \
  -H "Content-Type: application/json" \
  -d '{
    "pairs": [{"start": "2025-01-01", "end": "2025-07-01"}],
    "convention": "ACT_360"
  }'
```

## Troubleshooting

### Port Already in Use

If you see "address already in use" errors:

```bash
# Find what's using the port (Linux/Mac)
lsof -i :8787

# Windows
netstat -ano | findstr :8787

# Kill the process or use a different port
wrangler dev --config path/to/config.toml --port 8888
```

### Service Binding Not Found

If Gateway can't find other services:

1. Ensure all services are running
2. Check that service names in `gateway.toml` match the actual service names
3. Try restarting services in dependency order (Day-Count first, then others,
   then Gateway last)

### "INTERNAL_JWT_SECRET not configured"

This means `.dev.vars` wasn't loaded:

1. Check that `iac/workers/.dev.vars` exists
2. Ensure you're running commands from the service directory
3. Wrangler looks for `.dev.vars` relative to the wrangler.toml location

### Auth0 Errors

If you see Auth0-related errors but don't need authentication:

1. The Gateway will log warnings but continue operating
2. Internal services don't need Auth0 - only the Gateway does
3. For testing, you can bypass the Gateway and call services directly

## Alternative: Run Services Individually

You don't need to run all services at once. For development:

### Just TypeScript Services

```bash
# Terminal 1: Day-Count
cd services/daycount && npm run dev

# Terminal 2: Gateway (commented out service bindings)
cd services/gateway && npm run dev
```

### Just Python Services

```bash
# Terminal 1: Valuation
cd services/bond-valuation
wrangler dev --config ../../iac/workers/valuation.toml --port 8788
```

### Just UI + Gateway

```bash
# Terminal 1: Day-Count
cd services/daycount && npm run dev

# Terminal 2: Gateway
cd services/gateway && npm run dev -- --port 8791

# Terminal 3: UI
cd ui && npm run dev

# The UI automatically proxies /api/* requests to the Gateway on localhost:8791
```

## Development Workflow

### Hot Reloading

- **TypeScript services**: Auto-reload on file changes (via Wrangler)
- **Python services**: Auto-reload on file changes (via Wrangler)
- **UI**: Auto-reload on file changes (via Astro)

### Making Changes

1. Edit code in your IDE
2. Wrangler automatically rebuilds and restarts
3. Test your changes via curl or the UI
4. Run linters before committing:

   ```bash
   # Python
   py -3 -m black src
   py -3 -m ruff check --fix src
   py -3 -m mypy src

   # TypeScript
   npm run typecheck
   npm run lint
   ```

### Testing Service Communication

Test the full request flow through Gateway:

```bash
# Get an Auth0 token (if Auth0 configured)
# Or test without auth by calling services directly

# Test Day-Count through Gateway
curl -X POST http://localhost:8791/api/daycount/v1/count \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "pairs": [{"start": "2025-01-01", "end": "2025-07-01"}],
    "convention": "ACT_360"
  }'
```

## Deployment

When ready to deploy:

```bash
# Deploy all services
npm run deploy

# Or deploy individually
cd services/gateway && npm run deploy
cd services/daycount && npm run deploy

# Deploy Python services
cd services/bond-valuation
wrangler deploy --config ../../iac/workers/valuation.toml

cd services/metrics
wrangler deploy --config ../../iac/workers/metrics.toml

cd services/pricing
wrangler deploy --config ../../iac/workers/pricing.toml

# Deploy UI
cd ui && npm run deploy
```

## Next Steps

1. **Set up Auth0** (optional): See `docs/reference/authentication.md`
2. **Run tests**: `npm test` (from root)
3. **Generate architecture docs**: `npm run docs:arch`
4. **Read ADRs**: See `docs/adr/` for architectural decisions

## Resources

- [Wrangler Configuration](iac/workers/README.md)
- [Authentication Reference](docs/reference/authentication.md)
- [Project Notes](docs/reviews/project-notes.md)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
