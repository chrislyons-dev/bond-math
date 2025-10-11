# Metrics

> **Auto-generated from code** - Last updated: 2025-10-11

## Overview

- **Service ID:** `metrics`
- **Type:** cloudflare-worker-python
- **Layer:** Business Logic

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

## Components

This service contains 1 component(s):

### Component Diagram

High-level component relationships:

![Metrics Component Diagram](../../diagrams/structurizr-Components_metrics.png)

### Class Diagram

Detailed UML class diagram showing properties, methods, and relationships:

![Metrics Class Diagram](../../diagrams/class-diagram-metrics.png)

### Modules

#### main

Module: main

---

[← Back to Service Inventory](../services.md) |
[Architecture Overview](../index.md)
