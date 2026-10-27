// cdp.mjs: a minimal Chrome DevTools Protocol driver for the local browser checks (tests/browser/*.mjs). Local only,
// not part of CI. Zero dependencies: Node 24's built-in WebSocket speaks the protocol to a headless Edge or Chrome
// started with a fresh temporary profile. Nothing leaves this machine.
//
// Exports: sleep, findBrowser, Cdp, launch, openPage, allowDownloads (Browser.setDownloadBehavior), KEY_MODIFIERS,
// and the colour helpers parseRgb, luminance and contrast (WCAG 2).
// A page from openPage has navigate, reload, viewport, eval, addInitScript, press (with modifiers, so Shift+Tab is a
// real key press), hover, click, axNames, setFiles (DOM.setFileInputFiles) and the requests, console messages,
// exceptions and log entries it saw.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** An "rgb(r, g, b)" or "rgba(r, g, b, a)" colour as computed by the browser: { r, g, b, a }, or null. */
export function parseRgb(css) {
  const m = /rgba?\(([^)]*)\)/.exec(String(css));
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { r, g, b, a };
}

/** WCAG 2 relative luminance of an sRGB colour. */
export function luminance({ r, g, b }) {
  const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2 contrast ratio of two colours (1 to 21). */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function findBrowser(explicit) {
  const candidates = [
    explicit, process.env.BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) throw new Error('no Chromium-based browser found; pass --browser <exe>');
  return found;
}

export class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`)); else p.resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.seq;
    this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      setTimeout(() => { if (this.pending.delete(id)) reject(new Error(`${method}: timed out`)); }, 20000);
    });
  }

  waitFor(pred, ms = 20000) {
    return new Promise((resolve, reject) => {
      const l = (msg) => { if (pred(msg)) { this.listeners.delete(l); resolve(msg); } };
      this.listeners.add(l);
      setTimeout(() => { if (this.listeners.delete(l)) reject(new Error('event timed out')); }, ms);
    });
  }
}

export async function launch(exe, profile) {
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--disable-sync',
    '--disable-component-update', '--disable-default-apps', '--mute-audio', 'about:blank'];
  // The browser writes its debugging port to <profile>/DevToolsActivePort. Edge's launcher may hand over to a
  // separate process and exit at once, so the file, not the child process, says when the browser is ready.
  const portFile = path.join(profile, 'DevToolsActivePort');
  fs.rmSync(portFile, { force: true });
  const proc = spawn(exe, args, { stdio: 'ignore', windowsHide: true, detached: false });
  proc.on('error', () => { /* reported by the timeout below */ });
  let wsUrl = null;
  for (let waited = 0; waited < 30000 && !wsUrl; waited += 200) {
    await sleep(200);
    if (fs.existsSync(portFile)) {
      const [port, p] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
      if (port && p) wsUrl = `ws://127.0.0.1:${port.trim()}${p.trim()}`;
    }
  }
  if (!wsUrl) throw new Error('the browser did not open its debugging port within 30 s');
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('cannot connect to the browser')); });
  const closed = new Promise((r) => ws.addEventListener('close', r));
  const cdp = new Cdp(ws);
  return {
    cdp,
    async close() {
      cdp.send('Browser.close').catch(() => { /* the connection closes as the browser exits */ });
      await Promise.race([closed, sleep(10000)]);
      await sleep(1500); // let the browser release the profile before it is reused or deleted
    },
  };
}

/** Saves every download of the browser into `dir` under its suggested name; returns a waiter for one download. */
export async function allowDownloads(cdp, dir) {
  fs.mkdirSync(dir, { recursive: true });
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, eventsEnabled: true });
  const begun = new Map(); // guid -> suggested file name
  cdp.listeners.add((msg) => {
    if (msg.method === 'Browser.downloadWillBegin') begun.set(msg.params.guid, msg.params.suggestedFilename);
  });
  /** Resolves { file, name, state } when the next download ends (completed or canceled), or rejects after `ms`. */
  return (ms = 20000) => cdp.waitFor((m) => m.method === 'Browser.downloadProgress' && (m.params.state === 'completed' || m.params.state === 'canceled'), ms)
    .then((m) => {
      const name = begun.get(m.params.guid) ?? null;
      return { state: m.params.state, name, file: name ? path.join(dir, name) : null };
    });
}

// Records that the page saw a CSP violation (read back by the checks as window.__cspv).
const PROBE = `window.__cspv = [];
document.addEventListener('securitypolicyviolation', (e) => window.__cspv.push(e.effectiveDirective || e.violatedDirective));`;

/** CDP modifier bits for Input.dispatchKeyEvent and Input.dispatchMouseEvent. */
export const KEY_MODIFIERS = Object.freeze({ Alt: 1, Control: 2, Meta: 4, Shift: 8 });
const KEYS = {
  Enter: { code: 'Enter', vk: 13, text: '\r' },
  Tab: { code: 'Tab', vk: 9 },
  Shift: { code: 'ShiftLeft', vk: 16 },
  Escape: { code: 'Escape', vk: 27 },
  Space: { key: ' ', code: 'Space', vk: 32, text: ' ' },
};

export async function openPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const page = { sessionId, requests: [], console: [], exceptions: [], log: [] };
  cdp.listeners.add((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Network.requestWillBeSent') page.requests.push(msg.params.request.url);
    if (msg.method === 'Runtime.consoleAPICalled' && /error|warn/.test(msg.params.type)) {
      page.console.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') page.exceptions.push(msg.params.exceptionDetails.text);
    if (msg.method === 'Log.entryAdded' && /error|warning/.test(msg.params.entry.level)) page.log.push(msg.params.entry.text);
  });
  for (const d of ['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable']) await cdp.send(d, {}, sessionId);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE }, sessionId);
  page.navigate = async (url) => {
    page.requests.length = 0;
    const loaded = cdp.waitFor((m) => m.sessionId === sessionId && m.method === 'Page.loadEventFired');
    await cdp.send('Page.navigate', { url }, sessionId);
    await loaded;
    await sleep(400);
  };
  page.reload = async () => {
    const loaded = cdp.waitFor((m) => m.sessionId === sessionId && m.method === 'Page.loadEventFired');
    await cdp.send('Page.reload', { ignoreCache: true }, sessionId);
    await loaded;
    await sleep(400);
  };
  // The window size the page lays out at (headless browsers default to a small one). A mobile size also emulates touch.
  page.viewport = async (width, height, mobile = false) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile }, sessionId);
    await sleep(300);
  };
  page.eval = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) throw new Error(`evaluate: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
    return r.result.value;
  };
  // Real (trusted) input events, as a person's keyboard produces them; then a pause for the app's effects.
  // press('Tab'), press('Enter'), and with modifiers press('Tab', { shift: true }) for Shift+Tab: the modifier key
  // goes down first, the key carries the modifier bits (Shift = 8), and the modifier comes up last.
  page.press = async (key, { shift = false, ctrl = false, alt = false, meta = false } = {}) => {
    const k = KEYS[key];
    if (!k) throw new Error(`press: unknown key ${key}`);
    const held = [
      shift && ['Shift', KEY_MODIFIERS.Shift, 'ShiftLeft', 16],
      ctrl && ['Control', KEY_MODIFIERS.Control, 'ControlLeft', 17],
      alt && ['Alt', KEY_MODIFIERS.Alt, 'AltLeft', 18],
      meta && ['Meta', KEY_MODIFIERS.Meta, 'MetaLeft', 91],
    ].filter(Boolean);
    let modifiers = 0;
    for (const [name, bit, code, vk] of held) {
      modifiers |= bit;
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: name, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers }, sessionId);
    }
    const base = { key: k.key ?? key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk, modifiers };
    const text = k.text && !ctrl && !alt && !meta ? { text: k.text, unmodifiedText: k.text } : {};
    await cdp.send('Input.dispatchKeyEvent', { type: text.text ? 'keyDown' : 'rawKeyDown', ...base, ...text }, sessionId);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, sessionId);
    for (const [name, bit, code, vk] of held.reverse()) {
      modifiers &= ~bit;
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers }, sessionId);
    }
    await sleep(300);
  };
  // A script run in every new document of this page before the page's own scripts (for example, to keep references
  // to the built-ins a library might replace).
  page.addInitScript = (source) => cdp.send('Page.addScriptToEvaluateOnNewDocument', { source }, sessionId);
  // The mouse moves to a point without pressing (to leave a hovered element).
  page.hover = async ({ x, y }) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' }, sessionId);
    await sleep(150);
  };
  page.click = async ({ x, y }) => {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 }, sessionId);
    }
    await sleep(300);
  };
  // The accessible name the browser computes for each element matching a selector (what a screen reader announces).
  page.axNames = async (selector) => {
    await cdp.send('Accessibility.enable', {}, sessionId);
    const count = await page.eval(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
    const names = [];
    for (let i = 0; i < count; i++) {
      const r = await cdp.send('Runtime.evaluate', { expression: `document.querySelectorAll(${JSON.stringify(selector)})[${i}]` }, sessionId);
      const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { objectId: r.result.objectId, fetchRelatives: false }, sessionId);
      names.push(nodes[0]?.name?.value ?? null);
    }
    return names;
  };
  // Picks local files in an <input type="file">, as a person choosing them in the file dialog does; the page then
  // receives its change event.
  page.setFiles = async (selector, files) => {
    const r = await cdp.send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)})` }, sessionId);
    if (!r.result.objectId) throw new Error(`setFiles: no element ${selector}`);
    await cdp.send('DOM.enable', {}, sessionId);
    await cdp.send('DOM.setFileInputFiles', { objectId: r.result.objectId, files: files.map((f) => path.resolve(f)) }, sessionId);
    await sleep(300);
  };
  return page;
}
