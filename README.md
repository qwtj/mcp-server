# mcp-server

Made with https://github.com/qwtj/universal-agentic-workflow

A minimal Express-based "Model Context Protocol" server used as a template
for security-aware services.  It demonstrates several reusable subsystems such
as secret management, auditable logging, dynamic configuration, and a
sandboxed tool execution API.  The project is wired up with tests and
continuous integration gates for vulnerabilities and static analysis.

---

## Table of Contents

1. [Features](#features)
2. [Prerequisites & Setup](#prerequisites--setup)
3. [Configuration](#configuration)
4. [Running the Server](#running-the-server)
5. [API Endpoints & Use Cases](#api-endpoints--use-cases)
6. [Development & Testing](#development--testing)
7. [Security Scanning](#security-scanning)
8. [Contributing & Backlog](#contributing--backlog)
9. [Additional Notes](#additional-notes)

---

## Features

- **Secret manager** (`lib/secretManager.js`) abstracts access to sensitive
  values and supports pluggable backends for testing or alternate stores.
- **Audit logger** (`lib/auditLogger.js`) records events to
  `logs/audit.log` with SHA‑256 checksums.  The logger exposes
  `verifyIntegrity()` for tamper detection.
- **Configuration helper** (`lib/config.js`) loads an executable tool allowlist
  and can reload it at runtime.  Optional file watching is controlled by
  `ENABLE_ALLOWLIST_WATCH`.
- **Tool execution sandbox** (`lib/toolRunner.js`) spawns processes with
  resource limits, checks the allowlist, sanitises arguments and emits audit
  events.  Guarded by `ENABLE_TOOL_SANDBOX` so the endpoint can be feature
  flagged.
- **Input validation middleware** (`validators/validatePayload.js`) offering an
  example schema and helper for Express routes.
- **CI security gates** driven by scripts and workflow in
  `.github/workflows/ci.yml` with dependency and Semgrep scans.

## Prerequisites & Setup

1. Install [Node.js 18+](https://nodejs.org/).
2. Clone the repository and `cd` into the workspace.
3. Run `npm ci` to install dependencies.
4. (Optional) set up environment variables:
   - `PORT` – port for the server (default `3000`).
   - `ENABLE_TOOL_SANDBOX=true` to enable `/run-tool` endpoint.
   - `ENABLE_ALLOWLIST_WATCH=true` to auto-reload `config/allowlist.json`.
   - `SECRET_BACKEND` to override the default `env` backend.
   - `SECURITY_FAIL_LEVEL` when running scans locally (see [Security Scanning](#security-scanning)).

## Configuration

- `config/allowlist.json` should contain a JSON array of permitted tools for
  the sandbox.  Edit and call `require('./lib/config').reloadAllowlist()` or
  set `ENABLE_ALLOWLIST_WATCH` to `true` for automatic reloading.
- `security-config.json` holds defaults used by `scripts/run-scans.js`.

Secrets are accessed with `require('./lib/secretManager').getSecret(key)`.
Clients may inject a fake backend via `setBackend()` in tests.

## Running the Server

```bash
# start normally
npm start
# or launch with environment overrides
PORT=4000 ENABLE_TOOL_SANDBOX=true node server.js
```

The app exports the Express `app` object so it can be used by test suites and
other consumers.

## API Endpoints & Use Cases

- `GET /` – health endpoint, replies with "MCP server running".
- `GET /tool` – legacy/demo route; attempts to read the `TOOL_API_KEY`
  secret and logs an audit event.  Useful for verifying secret manager and
  audit logging are wired correctly.
- `POST /run-tool` – sandboxed execution of external binaries.  Expects JSON
  body `{ toolName, args }`; rejects requests when the feature flag is off
  or the tool is not allowlisted.  All activity is audited.

### MCP JSON‑RPC interface

The server implements the [Model Context Protocol (MCP)](https://aka.ms/mcp)
used by Visual Studio Code and other clients.  Incoming JSON-RPC messages may
be POSTed to either `/mcp` or `/` and the following methods are supported:

| Method | Description |
|--------|-------------|
| `initialize` | Negotiates capabilities and returns the available tools. |
| `model/getTools`, `tools`, `tools/list` | Return the tool metadata array. |
| `tools/call` | **execute** a tool, supplying `params.name` and
  `params.arguments` (the spec form used by VS Code's client). |
| `tool/run`, `tools/run`, `tool/execute` | Alternate invocation names that
  continue to be supported for backwards compatibility. |

When a tool call does not include an `id` it is treated as a notification and
an empty object `{}` is returned.  The built-in `mcp.listDir` tool is
implemented on the server side for convenience; other tools are executed via
`lib/toolRunner.js`.

Developers may also build additional routes and use `validators/validatePayload`
for request validation.

## Development & Testing

- Run the full test suite with coverage:

  ```bash
  npm test
  ```

- Unit tests cover each library component; integration tests exercise the
  Express routes and the CI pipeline itself (see
  `tests/integration/*`).
- The `scripts/hooks/preToolUse.mjs` file contains a Git hook used in
  development environments to warn about dangerous commands when the
  repository is in "agent mode"; it is not required for production.

## Security Scanning

Local scan scripts mirror the CI workflow:

```bash
npm run scan:sast   # semgrep static analysis
npm run scan:deps   # npm audit (severity controlled by SECURITY_FAIL_LEVEL)
npm run scan        # both
```

See `docs/security/ci-security-gates.md` for details on thresholds,
workflow behaviour and rule management.

## Contributing & Backlog

All open work is tracked under `state/`; files under `state/ungroomed/open`
have yet to be triaged.  The repository includes an intake agent that may
assist with issue creation and prioritisation (see `.github/agents/uwf-intake.agent.md`).

### Remaining Tasks

- Groom the backlog items listed in `state/ungroomed/open/*.md` and assign
  them to future sprints.
- Add more comprehensive Semgrep rules as security needs evolve.
- Implement additional secret backends if required (e.g. Vault, AWS KMS).

Contributions should follow existing coding and documentation conventions.

## Additional Notes

- Audit log files are stored in `logs/` and are gitignored; keep them secure.
- The `config.reloadAllowlist()` function logs failures via audit events for
  visibility.
- When deploying in production, ensure appropriate syslog/rotations for
  `logs/audit.log` and that secrets are provided via environment variables or
  a configured backend.

---

For any questions contact the maintainers or refer to the ADR documents in
`docs/adr/` for architectural rationale.
