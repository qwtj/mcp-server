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

app.get('/', (req, res) => {
  res.status(200).send('MCP server running');
});

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
