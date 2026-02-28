const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const auditLogger = require('../lib/auditLogger');
const config = require('../lib/config');
// toolRunner will be implemented later
let toolRunner;

describe('toolRunner unit tests', () => {
  beforeAll(() => {
    // clear module cache for toolRunner when it exists
    delete require.cache[require.resolve('../lib/toolRunner')];
    toolRunner = require('../lib/toolRunner');
  });

  test('UT-401: valid tool allowed by allowlist', () => {
    const file = require('path').join(__dirname, '..', 'config', 'allowlist.json');
    fs.writeFileSync(file, JSON.stringify(['dummy']));
    config.reloadAllowlist();
    expect(toolRunner.checkAllowlist('dummy')).toBe(true);
  });

  test('UT-402: disallowed tool rejected', () => {
    const file = require('path').join(__dirname, '..', 'config', 'allowlist.json');
    fs.writeFileSync(file, JSON.stringify([]));
    config.reloadAllowlist();
    expect(toolRunner.checkAllowlist('nope')).toBe(false);
  });

  test('UT-405: spawn uses child_process.spawn without shell', () => {
    const spy = jest.spyOn(child_process, 'spawn').mockImplementation(() => {
      const e = new (require('events'))();
      e.on = e.addListener;
      setImmediate(() => e.emit('exit', 0));
      return e;
    });
    fs.writeFileSync(require('path').join(__dirname, '..', 'config', 'allowlist.json'), JSON.stringify(['true']));
    config.reloadAllowlist();
    return toolRunner.executeTool('true', []).then(() => {
      expect(spy).toHaveBeenCalled();
      const opts = spy.mock.calls[0][2];
      expect(opts.shell).toBe(false);
      spy.mockRestore();
    });
  });

  test('UT-406: sandbox resource limits applied', () => {
    const spy = jest.spyOn(child_process, 'spawn').mockImplementation(() => {
      const e = new (require('events'))();
      e.on = e.addListener;
      setImmediate(() => e.emit('exit', 0));
      return e;
    });
    fs.writeFileSync(require('path').join(__dirname, '..', 'config', 'allowlist.json'), JSON.stringify(['true']));
    config.reloadAllowlist();
    return toolRunner.executeTool('true', [], { resourceLimits: { maxBuffer: 123 } }).then(() => {
      const opts = spy.mock.calls[0][2];
      // resourceLimits should be a nested object
      expect(opts.resourceLimits).toEqual({ maxBuffer: 123 });
      spy.mockRestore();
    });
  });

  test('UT-407: audit log entry created for allowed invocation', () => {
    const logSpy = jest.spyOn(auditLogger, 'logEvent');
    // stub spawn to exit normally
    jest.spyOn(child_process, 'spawn').mockImplementation(() => {
      const e = new (require('events'))();
      e.on = e.addListener;
      setImmediate(() => e.emit('exit', 0));
      return e;
    });
    fs.writeFileSync(require('path').join(__dirname, '..', 'config', 'allowlist.json'), JSON.stringify(['true']));
    config.reloadAllowlist();
    return toolRunner.executeTool('true', ['arg']).then(() => {
      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'tool_execution_started' }));
      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'tool_execution_finished' }));
      logSpy.mockRestore();
      child_process.spawn.mockRestore();
    });
  });

  test('UT-408: audit log entry created for denied invocation', () => {
    const logSpy = jest.spyOn(auditLogger, 'logEvent');
    fs.writeFileSync(require('path').join(__dirname, '..', 'config', 'allowlist.json'), JSON.stringify([]));
    config.reloadAllowlist();
    expect(() => toolRunner.executeTool('nope')).toThrow();
    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'tool_execution_denied' }));
    logSpy.mockRestore();
  });

  test('UT-409: executeTool sanitizes sensitive args', () => {
    const spy = jest.spyOn(child_process, 'spawn').mockImplementation(() => {
      const e = new (require('events'))();
      e.on = e.addListener;
      setImmediate(() => e.emit('exit', 0));
      return e;
    });
    fs.writeFileSync(require('path').join(__dirname, '..', 'config', 'allowlist.json'), JSON.stringify(['true']));
    config.reloadAllowlist();
    const logSpy = jest.spyOn(auditLogger, 'logEvent');
    return toolRunner.executeTool('true', ['password=123']).then(() => {
      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ args: ['[REDACTED]'] }));
      spy.mockRestore();
      logSpy.mockRestore();
    });
  });
});
