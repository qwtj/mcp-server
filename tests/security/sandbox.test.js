const fs = require('fs');
const path = require('path');
const toolRunner = require('../../lib/toolRunner');
const cfg = require('../../lib/config');

// security-specific stubs

describe('security tests for toolRunner', () => {
  test('ST-401: allowlist bypass', () => {
    // ensure executeTool respects allowlist even if config manipulated
    const file = path.join(__dirname, '..', '..', 'config', 'allowlist.json');
    fs.writeFileSync(file, JSON.stringify([]));
    const cfg = require('../../lib/config');
    cfg.reloadAllowlist();
    expect(() => toolRunner.executeTool('echo')).toThrow();
  });

  test('ST-402: sandbox escape attempt', () => {
    // verify spawn options include cwd
    const spy = jest.spyOn(require('child_process'), 'spawn').mockImplementation(() => {
      const e = new (require('events'))();
      e.on = e.addListener;
      setImmediate(() => e.emit('exit', 0));
      return e;
    });
    const file = path.join(__dirname, '..', '..', 'config', 'allowlist.json');
    fs.writeFileSync(file, JSON.stringify(['node']));
    cfg.reloadAllowlist();
    expect(cfg.getAllowlist()).toEqual(['node']);
    return toolRunner.executeTool('node', ['-e', 'console.log(process.cwd())'])
      .then(() => {
        expect(spy).toHaveBeenCalled();
        const call = spy.mock.calls[0];
        expect(call).toBeDefined();
        const opts = call[2];
        expect(opts.cwd).toBe(process.cwd());
      })
      .finally(() => {
        spy.mockRestore();
      });
  });

  test('ST-403: resource exhaustion', () => {
    const file = require('path').join(__dirname, '..', '..', 'config', 'allowlist.json');
    require('fs').writeFileSync(file, JSON.stringify(['node']));
    const cfg = require('../../lib/config');
    cfg.reloadAllowlist();
    // spawn a process that runs forever; our timeout should kill it
    return toolRunner.executeTool('node', ['-e', "while(true){}"], { timeout: 100 }).catch(err => {
      expect(err).toBeTruthy();
    });
  });

  test('ST-404: corrupted allowlist', () => {
    const file = path.join(__dirname, '..', '..', 'config', 'allowlist.json');
    const cfg = require('../../lib/config');
    fs.writeFileSync(file, '{notjson');
    const ok = cfg.reloadAllowlist();
    expect(ok).toBe(false);
  });

  test('ST-405: injection via args', () => {
    const spy = jest.spyOn(require('child_process'), 'spawn').mockImplementation(() => {
      const e = new (require('events'))();
      e.on = e.addListener;
      setImmediate(() => e.emit('exit', 0));
      return e;
    });
    const file = path.join(__dirname, '..', '..', 'config', 'allowlist.json');
    fs.writeFileSync(file, JSON.stringify(['echo']));
    cfg.reloadAllowlist();
    expect(cfg.getAllowlist()).toEqual(['echo']);
    return toolRunner.executeTool('echo', ['; rm -rf /'])
      .then(() => {
        expect(spy).toHaveBeenCalled();
        const call = spy.mock.calls[0];
        expect(call).toBeDefined();
        const callArgs = call[1];
        expect(callArgs).toEqual(['; rm -rf /']);
      })
      .finally(() => {
        spy.mockRestore();
      });
  });
  test('ST-406: audit log tamper detection', () => {
    const logFile = require('../../lib/auditLogger')._logFile;
    // write a fake entry then corrupt it
    const audit = require('../../lib/auditLogger');
    audit.logEvent({ event: 'test' });
    // corrupt file
    const contents = require('fs').readFileSync(logFile, 'utf8');
    require('fs').writeFileSync(logFile, contents.replace(/./, 'X'));
    expect(audit.verifyIntegrity()).toBe(false);
  });

  afterAll(() => {
    const file = path.join(__dirname, '..', '..', 'config', 'allowlist.json');
    fs.unwatchFile(file);
  });
});
