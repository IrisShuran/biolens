// Minimal browser driver for local verification of the BioLens static site.
//
// Design goals:
//  - No npm dependencies: only Node.js built-ins (needs Node >= 22 for global
//    WebSocket and fetch).
//  - Works with any Chromium-based browser installed on the machine.
//  - Never pipes the browser's stdio (restricted sandboxes forbid it); all
//    control happens over the DevTools protocol.
//
// Two ways to use it:
//   1. launch({...})          - start the browser itself, then drive it.
//   2. connect({port})        - attach to a browser that is already running with
//                               --remote-debugging-port. Use this when the
//                               environment blocks spawning a browser from Node.
//
// startBrowserHint() prints the command to start a browser by hand.
//
// Override the executable with the BIOLENS_BROWSER environment variable.

const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_PORT = Number(process.env.BIOLENS_CDP_PORT || 9222);

const CANDIDATES = [
  process.env.BIOLENS_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

function findBrowser() {
  for (const c of CANDIDATES) if (fs.existsSync(c)) return c;
  return null;
}

function browserArgs(port, profile, width, height, extra = []) {
  return [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-sync', '--disable-translate',
    '--window-size=' + width + ',' + height,
    '--allow-insecure-localhost',
    // Software WebGL so the Three.js scenes really render in headless mode.
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    ...extra,
  ];
}

function startBrowserHint(port = DEFAULT_PORT) {
  const exe = findBrowser() || '<path-to-chromium-browser>';
  return `"${exe}" ${browserArgs(port, '%TEMP%\\biolens-profile', 1440, 1050).join(' ')}`;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function probe(port, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    if (i < tries - 1) await sleep(300);
  }
  return null;
}

async function waitForEndpoint(port, tries = 120) {
  for (let i = 0; i < tries; i++) {
    const v = await probe(port, 1);
    if (v) return v;
    await sleep(150);
  }
  throw new Error(`DevTools endpoint not reachable on 127.0.0.1:${port}. Start a browser first:\n  ${startBrowserHint(port)}`);
}

// Connect to a browser already listening on `port` (and start one if needed).
async function connect(opts = {}) {
  const {
    port = DEFAULT_PORT,
    url = 'http://127.0.0.1:4174/',
    width = 1440,
    height = 1050,
    deviceScaleFactor = 1,
    mobile = false,
    autoLaunch = true,
    extraArgs = [],
  } = opts;

  let version = await probe(port, 1);
  let proc = null;
  let profile = null;

  if (!version) {
    if (!autoLaunch) throw new Error(`No browser on port ${port}.`);
    const exe = findBrowser();
    if (!exe) throw new Error('No Chromium-based browser found. Set BIOLENS_BROWSER.');
    profile = fs.mkdtempSync(path.join(os.tmpdir(), 'biolens-cdp-'));
    proc = spawn(exe, browserArgs(port, profile, width, height, extraArgs), {stdio: 'ignore', windowsHide: true});
    version = await waitForEndpoint(port);
  }

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, {once: true});
    ws.addEventListener('error', () => rej(new Error('DevTools socket failed')), {once: true});
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  const events = [];
  let sessionId = null;

  ws.addEventListener('message', ev => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const {res, rej} = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      return;
    }
    if (msg.method) {
      events.push(msg);
      const ls = listeners.get(msg.method);
      if (ls) for (const fn of ls) fn(msg.params, msg.sessionId);
    }
  });

  const raw = (method, params = {}, timeout = 30000, useSession = true) => new Promise((res, rej) => {
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); rej(new Error('CDP timeout: ' + method)); }, timeout);
    pending.set(id, {res: v => { clearTimeout(timer); res(v); }, rej: e => { clearTimeout(timer); rej(e); }});
    const payload = {id, method, params};
    if (useSession && sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
  });

  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(fn);
  };

  const consoleErrors = [];
  const pageErrors = [];
  on('Log.entryAdded', p => { if (p.entry && p.entry.level === 'error') consoleErrors.push(p.entry.text); });
  on('Runtime.consoleAPICalled', p => {
    if (p.type === 'error') consoleErrors.push((p.args || []).map(a => a.value ?? a.description ?? '').join(' '));
  });
  on('Runtime.exceptionThrown', p => {
    const d = p.exceptionDetails || {};
    pageErrors.push((d.exception && (d.exception.description || d.exception.value)) || d.text || 'unknown error');
  });

  const {targetId} = await raw('Target.createTarget', {url: 'about:blank'}, 30000, false);
  const attached = await raw('Target.attachToTarget', {targetId, flatten: true}, 30000, false);
  sessionId = attached.sessionId;

  await raw('Page.enable');
  await raw('Runtime.enable');
  await raw('Log.enable');
  await raw('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor, mobile});

  const send = (m, p = {}, t = 30000) => raw(m, p, t, true);

  async function evaluate(expression, {awaitPromise = false} = {}) {
    const r = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise, userGesture: true});
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('Evaluate failed: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text));
    }
    return r.result.value;
  }

  async function waitFor(expression, {timeout = 20000, label = expression, poll = 100} = {}) {
    const end = Date.now() + timeout;
    let lastErr;
    while (Date.now() < end) {
      try { if (await evaluate(`(()=>{try{return !!(${expression})}catch(e){return false}})()`)) return true; }
      catch (e) { lastErr = e; }
      await sleep(poll);
    }
    throw new Error(`waitFor timed out after ${timeout}ms: ${label}${lastErr ? ' (' + lastErr.message + ')' : ''}`);
  }

  async function rect(sel, index = 0) {
    return evaluate(`(()=>{const e=document.querySelectorAll(${JSON.stringify(sel)})[${index}];
      if(!e) return null; e.scrollIntoView({block:'center',inline:'center'});
      const b=e.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2,w:b.width,h:b.height};})()`);
  }

  async function mouse(type, x, y, button = 'left', extra = {}) {
    await send('Input.dispatchMouseEvent', {
      type, x, y, button, clickCount: type === 'mouseReleased' ? 1 : 0, ...extra,
    });
  }

  async function clickAt(x, y, {settle = 80} = {}) {
    await mouse('mouseMoved', x, y, 'none', {buttons: 0});
    await mouse('mousePressed', x, y, 'left', {buttons: 1, clickCount: 1});
    await sleep(30);
    await mouse('mouseReleased', x, y, 'left', {buttons: 0, clickCount: 1});
    await sleep(settle);
  }

  async function click(sel, {index = 0, timeout = 10000} = {}) {
    await waitFor(`document.querySelectorAll(${JSON.stringify(sel)}).length > ${index}`, {timeout, label: 'selector ' + sel});
    const r = await rect(sel, index);
    if (!r || r.w === 0) throw new Error('Element not visible/clickable: ' + sel);
    await sleep(60);
    const r2 = await rect(sel, index);
    await clickAt(r2.x, r2.y);
  }

  async function drag(sel, dx, dy, steps = 8) {
    const r = await rect(sel);
    if (!r) throw new Error('Cannot drag missing element: ' + sel);
    await mouse('mouseMoved', r.x, r.y, 'none', {buttons: 0});
    await mouse('mousePressed', r.x, r.y, 'left', {buttons: 1});
    for (let i = 1; i <= steps; i++) {
      await mouse('mouseMoved', r.x + dx * i / steps, r.y + dy * i / steps, 'left', {buttons: 1});
      await sleep(16);
    }
    await mouse('mouseReleased', r.x + dx, r.y + dy, 'left', {buttons: 0});
    await sleep(80);
  }

  async function wheel(sel, deltaY) {
    const r = await rect(sel);
    if (!r) throw new Error('Cannot wheel missing element: ' + sel);
    await send('Input.dispatchMouseEvent', {type: 'mouseWheel', x: r.x, y: r.y, deltaX: 0, deltaY, button: 'none', buttons: 0});
    await sleep(80);
  }

  const KEYS = {
    ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39], ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40],
    Enter: ['Enter', 13], Tab: ['Tab', 9], Space: ['Space', 32], Escape: ['Escape', 27],
  };

  async function key(keyName, {shift = false} = {}) {
    let key = keyName, code = keyName, vk = 0, text, modifiers = shift ? 8 : 0;
    if (KEYS[keyName]) { [code, vk] = KEYS[keyName]; if (keyName === 'Space') key = ' '; }
    else if (keyName === '+') { code = 'Equal'; vk = 187; text = '+'; modifiers |= 8; }
    else if (keyName === '-') { code = 'Minus'; vk = 189; text = '-'; }
    else if (keyName === '=') { code = 'Equal'; vk = 187; text = '='; }
    // Enter activates native buttons through its carriage-return text event.
    if (keyName === 'Enter') text = '\r';
    const base = {key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers};
    await send('Input.dispatchKeyEvent', {...base, type: text ? 'keyDown' : 'rawKeyDown', text});
    await send('Input.dispatchKeyEvent', {...base, type: 'keyUp'});
    await sleep(60);
  }

  async function screenshot(file) {
    const r = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    const abs = path.resolve(file);
    fs.mkdirSync(path.dirname(abs), {recursive: true});
    fs.writeFileSync(abs, Buffer.from(r.data, 'base64'));
    return abs;
  }

  async function setViewport(w, h, isMobile = mobile) {
    await raw('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor, mobile: isMobile});
    await sleep(250);
  }

  async function close() {
    // Only closes the browser this driver attached to / started.
    try { await raw('Browser.close', {}, 4000, false); } catch { /* fall through */ }
    await sleep(300);
    try { ws.close(); } catch {}
    if (proc) { try { proc.kill(); } catch {} }
    if (profile) { try { fs.rmSync(profile, {recursive: true, force: true}); } catch {} }
    await sleep(100);
  }

  async function goto(u) {
    await send('Page.navigate', {url: u});
    await sleep(300);
  }

  return {
    browser: version.Browser, evaluate, waitFor, click, clickAt, drag, wheel, key,
    screenshot, setViewport, close, send, on, rect, goto,
    consoleErrors, pageErrors, events,
  };
}

module.exports = {connect, findBrowser, startBrowserHint, DEFAULT_PORT};
