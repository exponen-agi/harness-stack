# Security Policy

## Supported versions

Harness Stack is pre-1.0 (currently `0.1.x`). There's one supported line:
**the latest release on `main`.** Security fixes land there; we don't
maintain older versions in parallel at this stage.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a security vulnerability —
that publishes the details before a fix exists.

Instead, use GitHub's private reporting:

1. Go to the [Security tab](https://github.com/exponen-agi/harness-stack/security/advisories/new)
   of this repository.
2. Click **"Report a vulnerability"** and fill in what you found.

This reaches the maintainer(s) listed in
[`.github/CODEOWNERS`](.github/CODEOWNERS) privately.

If you don't have (or don't want) a GitHub account, opening a regular issue
with **no technical details** — just "I think I found a security issue,
please contact me" plus a way to reach you — is fine too; a maintainer will
follow up privately.

## What counts as in scope

Harness Stack is a **code generator**: it reads YAML specs and writes
plain-text config files for AI coding tools. Things worth a security report:

- A crafted `.subagents/*.yaml`, `model-map.yaml`, or `trigger-map.yaml`
  that causes the CLI to write outside the intended project directory,
  execute unintended commands, or otherwise behave unsafely.
- A generated file that could cause an AI tool to do something the
  developer didn't consent to (e.g. bypassing the consent gates around
  Spec Kit / Superpowers installation described in the README).
- Dependency vulnerabilities not already caught by our CI's
  `npm audit --audit-level=high` step or Dependabot.

Things generally **out of scope**:

- Vulnerabilities in an AI model itself, or in a third-party tool (Claude
  Code, Cursor, etc.) that Harness Stack generates files for — report those
  to the tool's own vendor.
- Issues that require the attacker to already control the machine running
  `harness` (this tool assumes a trusted local environment, same as any
  other dev-time CLI).

## What to expect

We aim to acknowledge reports within a few days and keep you updated as a
fix is worked on. Please give us reasonable time to ship a fix before any
public disclosure.
