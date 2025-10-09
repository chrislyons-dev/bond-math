# Metrics

> **Auto-generated from code** - Last updated: 2025-10-09

## Overview

**Service ID:** `metrics` **Type:** cloudflare-worker-python **Layer:** Business
Logic

Bond risk metrics (duration, convexity, PV01, DV01)

## Endpoints

### `POST /duration`

**Configuration:**

- **Authentication:** internal-jwt
- **Scope:** metrics:write

### `POST /convexity`

**Configuration:**

- **Authentication:** internal-jwt
- **Scope:** metrics:write

### `POST /risk`

**Configuration:**

- **Authentication:** internal-jwt
- **Scope:** metrics:write

## Dependencies

### Incoming Dependencies

This service is used by:

- **Gateway**

## Deployment

### Preview Environment

- **bond-math-metrics-preview** (Cloudflare Workers)

![Preview Deployment Diagram](../../diagrams/structurizr-Deployment_preview.png)

### Production Environment

- **bond-math-metrics** (Cloudflare Workers)

![Production Deployment Diagram](../../diagrams/structurizr-Deployment_production.png)

---

[← Back to Service Inventory](../services.md) |
[Architecture Overview](../index.md)
