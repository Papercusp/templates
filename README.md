# Papercusp Official templates

Composable **app** and **aspect** templates for building papercusp-powered
apps. Each `<template-id>/` directory is one template:

- `template.yaml` — the machine-readable manifest: pinned components,
  decision points, what it composes with, category, and its checks.
- `GUIDE.md` — the composition prompt an agent follows, written in
  MUST / SHOULD / FREE tiers.
- `checks/` — portable, app-parameterized acceptance checks copied verbatim
  into the composed app (driven by the app's `TEMPLATE_CHECKS_CONFIG`).

## The set

| Template | Scope | Category |
|---|---|---|
| `agentic-desktop-app` | app | app |
| `tauri-desktop-shell` | aspect | shell |
| `papercusp-ops-hives` | aspect | agentic |
| `papercusp-data-sync` | aspect | data |
| `papercusp-data-layer` | aspect | data |
| `papercusp-search` | aspect | search |

An app is a **composition of templates**: an `app`-scope template pulls in
its `requires` closure of aspects, and the composed app must pass the UNION
of every composed template's checks.

## Installing

Templates are distributed through the **Papercusp Cupboard** (the listings
directory built into the operator app). Install from the Cupboard UI, or
point the operator's install-template endpoint at this repo.

## Docs

These templates assume you are building ON a live papercusp install. The
canonical documentation is served on your install at `/internal/docs`
(start with the `agent-insights` section — each template's `template.yaml`
`docs:` list names its pages), and the operator app itself is a running
reference instance of every pattern encoded here.

> This repo is a published mirror of the canonical `templates/` tree in the
> papercusp monorepo; changes land there first and are synced here on
> release.
