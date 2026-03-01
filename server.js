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
const config = require('./lib/config');
const toolRunner = require('./lib/toolRunner');
function _buildTools() {
  try {
    const allow = config.getAllowlist();
    if (Array.isArray(allow) && allow.length > 0) {
      return allow.map(name => ({ name }));
    }
  } catch (e) {
    // fallthrough to example tool
  }
  return [{ name: 'example-tool', description: 'example tool for MCP' }];
}

app.get('/', (req, res) => {
  res.status(200).json({ tools: _buildTools() });
});

// explicitly return 404 for OPTIONS on root per tests
app.options('/', (req, res) => res.status(404).send());

// JSON-RPC style handlers for MCP
async function handleJsonRpc(req, res) {
  const payload = req.body;
  // debug: log incoming JSON-RPC payloads to help diagnose client mismatches
  console.info('json-rpc received:', JSON.stringify(payload));
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'invalid payload' });

  // notifications (no id) should return empty object
  if (!Object.prototype.hasOwnProperty.call(payload, 'id')) {
    return res.status(200).json({});
  }

  const id = payload.id;
  const method = payload.method;

  // be tolerant of method naming variants from different clients
  const m = typeof method === 'string' ? method.toLowerCase() : '';

  if (m.includes('initialize')) {
    return res.status(200).json({ jsonrpc: '2.0', id, result: { capabilities: { tools: _buildTools() } } });
  }

  if (m.includes('tools')) {
    return res.status(200).json({ jsonrpc: '2.0', id, result: { tools: _buildTools() } });
  }

  // accept requests to run a tool: methods like 'tools/run', 'tool/run', 'tool/execute'
  if (m.includes('run') || m.includes('execute')) {
    const params = payload.params || {};
    const toolName = params.toolName || params.name || (params.tool && params.tool.name);
    const args = params.args || [];
    if (!toolName) {
      return res.status(200).json({ jsonrpc: '2.0', id, error: { message: 'missing toolName' } });
    }
    try {
      const result = await toolRunner.executeTool(toolName, args, {});
      return res.status(200).json({ jsonrpc: '2.0', id, result: { execution: result } });
    } catch (err) {
      return res.status(200).json({ jsonrpc: '2.0', id, error: { message: err.message } });
    }
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
