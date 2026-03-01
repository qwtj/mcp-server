// server.js
// Express server scaffold for MCP project

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// infrastructure components
const secretManager = require('./lib/secretManager');
const auditLogger = require('./lib/auditLogger');

// log startup event
try {
  auditLogger.logEvent({ event: 'server_startup', port: PORT });
} catch (e) {
  console.error('failed to write startup audit log', e);
}

// health endpoint
app.get('/health', (req, res) => {
  res.status(200).send('MCP server running');
});

// tools list (derive from allowlist if available, otherwise provide a small example tool)
const fs = require('fs');
const path = require('path');
const os = require('os');
const config = require('./lib/config');
const toolRunner = require('./lib/toolRunner');

function resolveRequestedPath(requested) {
  const value = String(requested || '.');
  if (value === '~') {
    return os.homedir();
  }
  if (value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2));
  }
  return path.resolve(value);
}

function _buildTools() {
  try {
    const allow = config.getAllowlist();
    if (Array.isArray(allow) && allow.length > 0) {
      // expose MCP-style tool descriptors with explicit input schemas
      const base = allow.map(name => ({
        id: name,
        name,
        description: `allowlisted tool ${name}`,
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: true
        }
      }));
      // also expose a server-side MCP tool for listing directories
      base.push({
        id: 'mcp.listDir',
        name: 'mcp_listdir',
        description: 'List files in a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute or relative path to list' },
            dir: { type: 'string', description: 'Alias for path' }
          },
          additionalProperties: true
        }
      });
      return base;
    }
  } catch (e) {
    // fallthrough to example tool
  }
  // fallback tools should also include ids and minimal params so clients
  // (including VS Code) don't reject the list as "invalid".
  return [
    {
      id: 'example-tool',
      name: 'example-tool',
      description: 'example tool for MCP',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: true
      }
    },
    {
      id: 'mcp.listDir',
      name: 'mcp_listdir',
      description: 'List files in a directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative path to list' },
          dir: { type: 'string', description: 'Alias for path' }
        },
        additionalProperties: true
      }
    }
  ];
}

app.get('/', (req, res) => {
  res.status(200).json({ tools: _buildTools() });
});

// explicitly return 404 for OPTIONS on root per tests
app.options('/', (req, res) => res.status(404).send());

// JSON-RPC style handlers for MCP
async function handleJsonRpc(req, res) {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'invalid payload' });

  // Simple non-JSON-RPC request (used by some MCP clients): if the body
  // contains a `path` or `dir` field and lacks an `id`, treat it as a
  // basic listDir invocation.  Respond with a JSON-RPC‑style object so
  // clients that blindly expect `jsonrpc`/`result` don't choke.
  if (!Object.prototype.hasOwnProperty.call(payload, 'id')) {
    if (payload.path || payload.dir) {
      const requested = payload.path || payload.dir || '.';
      const target = resolveRequestedPath(requested);
      try {
        const entries = fs.readdirSync(target, { withFileTypes: true })
          .map(d => ({ name: d.name, type: d.isDirectory() ? 'dir' : 'file' }));
        return res.status(200).json({ content: entries });
      } catch (err) {
        return res.status(200).json({ content: [], error: err.message });
      }
    }
    // existing notification handling
    return res.status(200).json({});
  }

  const id = payload.id;
  const method = payload.method;

  // be tolerant of method naming variants from different clients
  const m = typeof method === 'string' ? method.toLowerCase() : '';

  if (m.includes('initialize')) {
    return res.status(200).json({ jsonrpc: '2.0', id, result: { capabilities: { tools: _buildTools() } } });
  }

  // tool invocation methods (different clients use various names).
  // `tools/call` is the LSP-style name that VS Code's MCP client now uses.
  // Also accept a bare tool name/id as the method itself; some wrappers send
  // `{method: "mcp.listDir", params:{...}}` directly.  Build the tool list
  // so we can recognise those names.
  const tools = _buildTools();
  const toolNames = tools.flatMap(t => [t.id, t.name].filter(Boolean).map(v => String(v).toLowerCase()));

  if (
    m === 'tools/call' ||
    m === 'tool/call' ||
    m.includes('run') ||
    m.includes('execute') ||
    toolNames.includes(m)
  ) {
    const params = payload.params || {};
    const toolArgsObject = params.arguments || {};
    // if the method itself matched a tool name/id, use that as the toolName by
    // default, unless the caller explicitly provided a different name field.
    const toolName =
      toolNames.includes(m) && !params.name && !params.toolName
        ? (tools.find(t => [t.id, t.name].filter(Boolean).map(v => String(v).toLowerCase()).includes(m))?.id || m)
        : params.toolName || params.name || (params.tool && params.tool.name) || params.id;
    const args = params.args || [];
    if (!toolName) {
      return res.status(200).json({ jsonrpc: '2.0', id, error: { message: 'missing toolName' } });
    }

    // Server-side implementation for the built-in mcp.listDir tool
    if (
      toolName === 'mcp.listDir' ||
      String(toolName).toLowerCase() === 'mcp_listdir' ||
      String(toolName).toLowerCase() === 'listdir' ||
      String(toolName).toLowerCase() === 'list-dir'
    ) {
      const requested = params.path || params.dir || toolArgsObject.path || toolArgsObject.dir || args[0] || '.';
      const target = resolveRequestedPath(requested);
      try {
        const entries = fs.readdirSync(target, { withFileTypes: true }).map(d => ({ name: d.name, type: d.isDirectory() ? 'dir' : 'file' }));
        // include MCP-compliant content blocks while preserving `entries`
        // for existing callers/tests.
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: {
            entries,
            structuredContent: { entries },
            content: [{ type: 'text', text: JSON.stringify(entries) }]
          }
        });
      } catch (err) {
        return res.status(200).json({ jsonrpc: '2.0', id, error: { message: err.message } });
      }
    }

    try {
      const result = await toolRunner.executeTool(toolName, args, {});
      return res.status(200).json({ jsonrpc: '2.0', id, result: { execution: result } });
    } catch (err) {
      return res.status(200).json({ jsonrpc: '2.0', id, error: { message: err.message } });
    }
  }

  // explicit tool listing endpoints
  if (m === 'tools' || m === 'tools/list' || m === 'model/gettools' || m === 'tool/gettools' || m.endsWith('/gettools')) {
    return res.status(200).json({ jsonrpc: '2.0', id, result: { tools: _buildTools() } });
  }

  return res.status(400).json({ jsonrpc: '2.0', id, error: { message: 'method not supported' } });
}

app.post('/mcp', express.json(), handleJsonRpc);
app.post('/', express.json(), handleJsonRpc);

// sample tool execution route that reads a secret and logs the access
app.get('/tool', (req, res) => {
  // legacy/demo route retained; still reads a secret and logs
  try {
    const secret = secretManager.getSecret('TOOL_API_KEY');
    auditLogger.logEvent({ event: 'tool_access', secretKey: 'TOOL_API_KEY' });
    res.status(200).json({ result: 'tool executed', secretStub: !!secret });
  } catch (err) {
    auditLogger.logEvent({ event: 'tool_access_failed', reason: err.message });
    res.status(500).json({ error: err.message });
  }
});

// new route for sandboxed tool execution (feature-flagged)
app.post('/run-tool', express.json(), async (req, res) => {
  if (process.env.ENABLE_TOOL_SANDBOX !== 'true') {
    return res.status(404).json({ error: 'sandbox feature disabled' });
  }
  const { toolName, args = [] } = req.body;
  try {
    const toolRunner = require('./lib/toolRunner');
    const result = await toolRunner.executeTool(toolName, args, {});
    res.status(200).json({ result: 'executed', details: result });
  } catch (err) {
    auditLogger.logEvent({ event: 'run_tool_error', toolName, error: err.message });
    res.status(400).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
