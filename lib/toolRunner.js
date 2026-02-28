const child_process = require('child_process');
const auditLogger = require('./auditLogger');
const config = require('./config');

function checkAllowlist(toolName) {
  const allowlist = config.getAllowlist();
  return allowlist.includes(toolName);
}

function sanitizeArgs(args) {
  // simple redaction: replace any argument containing password or secret patterns
  return args.map(a => {
    if (String(a).toLowerCase().includes('password') || String(a).toLowerCase().includes('secret')) {
      return '[REDACTED]';
    }
    return a;
  });
}

function executeTool(toolName, args = [], options = {}) {
  // ensure string args
  if (!checkAllowlist(toolName)) {
    auditLogger.logEvent({ event: 'tool_execution_denied', toolName, args: sanitizeArgs(args) });
    const err = new Error(`Tool "${toolName}" is not allowed`);
    err.code = 'NOT_ALLOWED';
    throw err;
  }

  const sanitized = sanitizeArgs(args);
  auditLogger.logEvent({ event: 'tool_execution_started', toolName, args: sanitized });

  const spawnOptions = {
    shell: false,
    cwd: options.cwd || process.cwd(),
    uid: options.uid,
    gid: options.gid,
    timeout: options.timeout || 5000,
    killSignal: options.killSignal || 'SIGKILL',
    stdio: options.stdio || 'ignore',
    // Node 16+ resourceLimits object
    resourceLimits: options.resourceLimits || { maxBuffer: 1024 * 1024 }
  };

  const child = child_process.spawn(toolName, args, spawnOptions);

  return new Promise((resolve, reject) => {
    let finished = false;

    child.on('error', err => {
      if (!finished) {
        finished = true;
        auditLogger.logEvent({ event: 'tool_execution_failed', toolName, error: err.message });
        reject(err);
      }
    });

    child.on('exit', (code, signal) => {
      if (!finished) {
        finished = true;
        auditLogger.logEvent({ event: 'tool_execution_finished', toolName, code, signal });
        if (code === 0) {
          resolve({ code, signal });
        } else {
          const err = new Error(`Tool exited with code ${code}`);
          err.code = code;
          reject(err);
        }
      }
    });
  });
}

module.exports = {
  checkAllowlist,
  executeTool,
  sanitizeArgs
};