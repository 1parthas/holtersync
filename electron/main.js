const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { execFile, exec } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let adbClient = null;

// ── WiFi Server ───────────────────────────────────────────────────────────────
let wifiServer = null;
let wssServer = null;
const WIFI_PORT = 8765;
const wifiClients = new Set();

// ── USB Live Server ───────────────────────────────────────────────────────────
let usbServer = null;
let usbWss = null;
const USB_PORT = 8766;
const usbClients = new Set();

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function getMobilePage(_wsUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>HolterSync – Send Data</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e5e5e5;min-height:100vh;padding:20px}
  h1{color:#00ff88;font-size:18px;margin-bottom:4px;display:flex;align-items:center;gap:8px}
  .sub{color:#666;font-size:12px;margin-bottom:24px}
  .dot{width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block}
  .dot.on{background:#00ff88;animation:pulse 1.5s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:16px}
  label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px}
  textarea{width:100%;background:#111;border:1px solid #333;color:#fff;border-radius:8px;padding:12px;font-size:15px;resize:none;height:100px;outline:none}
  textarea:focus{border-color:#6366f1}
  input[type=file]{display:none}
  .btn{width:100%;padding:14px;border-radius:10px;border:none;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s}
  .btn-send{background:#6366f1;color:#fff;margin-bottom:10px}
  .btn-send:active{background:#4f46e5;transform:scale(.98)}
  .btn-file{background:#1a1a1a;color:#6366f1;border:1px solid #6366f1}
  .btn-file:active{background:#6366f120}
  .status{text-align:center;padding:10px;border-radius:8px;font-size:13px;margin-top:12px}
  .status.ok{background:#00ff8820;color:#00ff88}
  .status.err{background:#ef444420;color:#ef4444}
  .msg-list{max-height:150px;overflow-y:auto;margin-top:8px}
  .msg-item{font-size:11px;color:#555;padding:4px 0;border-bottom:1px solid #1f1f1f}
  .pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;margin-right:4px}
  .pill-text{background:#6366f120;color:#818cf8}
  .pill-file{background:#00ff8820;color:#00ff88}
</style>
</head>
<body>
<h1><span class="dot" id="dot"></span> HolterSync</h1>
<p class="sub">Send data to your PC in real-time</p>

<div class="card">
  <label>Type a message</label>
  <textarea id="txt" placeholder="Type anything — ECG notes, patient info, commands…"></textarea>
  <button class="btn btn-send" onclick="sendText()">Send Text to PC</button>
  <label for="filePick" style="cursor:pointer">
    <button class="btn btn-file" onclick="document.getElementById('filePick').click()">Pick & Send File</button>
  </label>
  <input type="file" id="filePick" multiple onchange="sendFiles(this.files)"/>
</div>

<div id="statusBox"></div>
<div class="card" id="logCard" style="display:none">
  <label>Sent</label>
  <div class="msg-list" id="log"></div>
</div>

<script>
const wsUrl = 'ws://' + location.hostname + ':${WIFI_PORT}/ws';
let ws;
let ready = false;
function connect() {
  ws = new WebSocket(wsUrl);
  ws.onopen = () => { ready = true; document.getElementById('dot').className = 'dot on'; };
  ws.onclose = () => { ready = false; document.getElementById('dot').className = 'dot'; setTimeout(connect, 2000); };
  ws.onerror = () => {};
}
connect();

function status(msg, ok) {
  const el = document.getElementById('statusBox');
  el.innerHTML = '<div class="status '+(ok?'ok':'err')+'">'+msg+'</div>';
  setTimeout(() => el.innerHTML = '', 3000);
}
function log(pill, pillClass, text) {
  document.getElementById('logCard').style.display = '';
  const d = document.getElementById('log');
  d.innerHTML = '<div class="msg-item"><span class="pill '+pillClass+'">'+pill+'</span>'+text+'</div>' + d.innerHTML;
}

function sendText() {
  const txt = document.getElementById('txt').value.trim();
  if (!txt) return status('Type something first', false);
  if (!ready) return status('Not connected to PC', false);
  ws.send(JSON.stringify({ type: 'text', payload: txt, ts: Date.now() }));
  status('Sent!', true);
  log('TEXT', 'pill-text', txt.slice(0, 60));
  document.getElementById('txt').value = '';
}

function sendFiles(files) {
  if (!files.length) return;
  if (!ready) return status('Not connected to PC', false);
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      ws.send(JSON.stringify({ type: 'file', name: file.name, size: file.size, data: e.target.result, ts: Date.now() }));
      status('File sent: ' + file.name, true);
      log('FILE', 'pill-file', file.name + ' (' + (file.size/1024).toFixed(1) + ' KB)');
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('txt').addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') sendText();
});
</script>
</body>
</html>`;
}

function startWifiServer() {
  const express = require('express');
  const { WebSocketServer } = require('ws');
  const expressApp = express();
  const ip = getLocalIP();

  expressApp.get('/', (req, res) => {
    res.send(getMobilePage(''));
  });

  wifiServer = http.createServer(expressApp);
  wssServer = new WebSocketServer({ server: wifiServer, path: '/ws' });

  wssServer.on('connection', (ws) => {
    wifiClients.add(ws);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('wifi:client-connected', { count: wifiClients.size });
    }
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('wifi:data-received', msg);
        }
        // Save files to disk
        if (msg.type === 'file' && msg.data) {
          const saveDir = path.join(os.homedir(), 'Downloads', 'USB Transfer', 'wifi');
          fs.mkdirSync(saveDir, { recursive: true });
          const base64 = msg.data.split(',')[1] || msg.data;
          fs.writeFileSync(path.join(saveDir, msg.name), Buffer.from(base64, 'base64'));
        }
      } catch (_) {}
    });
    ws.on('close', () => {
      wifiClients.delete(ws);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('wifi:client-connected', { count: wifiClients.size });
      }
    });
  });

  wifiServer.listen(WIFI_PORT, '0.0.0.0', () => {
    console.log(`WiFi server running at http://${ip}:${WIFI_PORT}`);
  });
}

function stopWifiServer() {
  wifiClients.forEach(ws => ws.terminate());
  wifiClients.clear();
  if (wssServer) { wssServer.close(); wssServer = null; }
  if (wifiServer) { wifiServer.close(); wifiServer = null; }
}

// ── USB Live Server ───────────────────────────────────────────────────────────
function getUsbMobilePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<title>HolterSync – USB Send</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e5e5e5;min-height:100vh;padding:20px}
  h1{color:#6366f1;font-size:18px;margin-bottom:4px;display:flex;align-items:center;gap:8px}
  .sub{color:#666;font-size:12px;margin-bottom:24px}
  .badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-bottom:16px}
  .badge.on{background:#6366f120;color:#818cf8;border:1px solid #6366f140}
  .badge.off{background:#ef444420;color:#ef4444;border:1px solid #ef444440}
  .dot{width:7px;height:7px;border-radius:50%;display:inline-block}
  .dot.on{background:#818cf8;animation:pulse 1.5s infinite}
  .dot.off{background:#ef4444}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:16px;margin-bottom:14px}
  label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:8px}
  textarea{width:100%;background:#111;border:1px solid #333;color:#fff;border-radius:8px;padding:12px;font-size:15px;resize:none;height:110px;outline:none}
  textarea:focus{border-color:#6366f1}
  input[type=file]{display:none}
  .btn{width:100%;padding:14px;border-radius:10px;border:none;font-size:15px;font-weight:600;cursor:pointer;transition:all .15s;margin-bottom:10px}
  .btn-send{background:#6366f1;color:#fff}
  .btn-send:active{background:#4f46e5;transform:scale(.98)}
  .btn-send:disabled{background:#333;color:#666;cursor:not-allowed}
  .btn-file{background:#1a1a1a;color:#6366f1;border:1px solid #6366f1}
  .btn-file:active{background:#6366f115}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:30px;font-size:13px;font-weight:600;opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap}
  .toast.ok{background:#6366f1;color:#fff}
  .toast.err{background:#ef4444;color:#fff}
  .toast.show{opacity:1}
  .log{max-height:130px;overflow-y:auto;margin-top:10px}
  .log-item{font-size:11px;color:#555;padding:5px 0;border-bottom:1px solid #1f1f1f;display:flex;gap:6px;align-items:flex-start}
  .tag{padding:1px 7px;border-radius:20px;font-size:9px;font-weight:700;shrink:0}
  .tag-text{background:#6366f120;color:#818cf8}
  .tag-file{background:#22c55e20;color:#22c55e}
  .usb-badge{background:#f59e0b20;color:#f59e0b;border:1px solid #f59e0b40;padding:6px 12px;border-radius:8px;font-size:11px;text-align:center;margin-bottom:14px}
</style>
</head>
<body>
<h1>⚡ HolterSync</h1>
<p class="sub">USB Live Transfer</p>

<div class="usb-badge">🔌 Connected via USB cable</div>
<div id="badge" class="badge off"><span class="dot off" id="dot"></span><span id="badgeText">Connecting...</span></div>

<div class="card">
  <label>Type a message or data</label>
  <textarea id="txt" placeholder="Type anything — patient notes, commands, ECG markers…"></textarea>
  <button id="sendBtn" class="btn btn-send" onclick="sendText()" disabled>Send to PC via USB</button>
  <button class="btn btn-file" onclick="document.getElementById('fp').click()">📎 Attach & Send File</button>
  <input type="file" id="fp" multiple onchange="sendFiles(this.files)"/>
</div>

<div id="logWrap" class="card" style="display:none">
  <label>Sent log</label>
  <div class="log" id="log"></div>
</div>

<div class="toast" id="toast"></div>

<script>
const wsUrl = 'ws://localhost:${USB_PORT}/ws';
let ws, ready = false;

function setReady(v) {
  ready = v;
  const dot = document.getElementById('dot');
  const badge = document.getElementById('badge');
  const badgeText = document.getElementById('badgeText');
  const btn = document.getElementById('sendBtn');
  dot.className = 'dot ' + (v ? 'on' : 'off');
  badge.className = 'badge ' + (v ? 'on' : 'off');
  badgeText.textContent = v ? 'Connected to PC' : 'Not connected';
  btn.disabled = !v;
}

function connect() {
  ws = new WebSocket(wsUrl);
  ws.onopen = () => setReady(true);
  ws.onclose = () => { setReady(false); setTimeout(connect, 1500); };
  ws.onerror = () => {};
}
connect();

function toast(msg, ok) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + (ok ? 'ok' : 'err') + ' show';
  setTimeout(() => el.className = 'toast', 2200);
}

function addLog(tag, cls, text) {
  document.getElementById('logWrap').style.display = '';
  const d = document.getElementById('log');
  d.innerHTML = '<div class="log-item"><span class="tag ' + cls + '">' + tag + '</span><span>' + text.slice(0,80) + '</span></div>' + d.innerHTML;
}

function sendText() {
  const txt = document.getElementById('txt').value.trim();
  if (!txt) { toast('Type something first', false); return; }
  if (!ready) { toast('Not connected', false); return; }
  ws.send(JSON.stringify({ type: 'text', payload: txt, ts: Date.now(), via: 'usb' }));
  toast('Sent via USB!', true);
  addLog('TEXT', 'tag-text', txt);
  document.getElementById('txt').value = '';
}

function sendFiles(files) {
  if (!files.length || !ready) { if (!ready) toast('Not connected', false); return; }
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      ws.send(JSON.stringify({ type: 'file', name: file.name, size: file.size, data: e.target.result, ts: Date.now(), via: 'usb' }));
      toast('File sent: ' + file.name, true);
      addLog('FILE', 'tag-file', file.name);
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('txt').addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') sendText();
});
</script>
</body>
</html>`;
}

function startUsbServer() {
  const express = require('express');
  const { WebSocketServer } = require('ws');
  const expressApp = express();

  expressApp.get('/', (req, res) => res.send(getUsbMobilePage()));

  usbServer = http.createServer(expressApp);
  usbWss = new WebSocketServer({ server: usbServer, path: '/ws' });

  usbWss.on('connection', (ws) => {
    usbClients.add(ws);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('usb-live:client-connected', { count: usbClients.size });
    }
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('usb-live:data-received', msg);
        }
        if (msg.type === 'file' && msg.data) {
          const saveDir = path.join(os.homedir(), 'Downloads', 'USB Transfer', 'usb-live');
          fs.mkdirSync(saveDir, { recursive: true });
          const base64 = msg.data.split(',')[1] || msg.data;
          fs.writeFileSync(path.join(saveDir, msg.name), Buffer.from(base64, 'base64'));
        }
      } catch (_) {}
    });
    ws.on('close', () => {
      usbClients.delete(ws);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('usb-live:client-connected', { count: usbClients.size });
      }
    });
  });

  usbServer.listen(USB_PORT, '127.0.0.1', () => {
    console.log(`USB live server on port ${USB_PORT}`);
  });
}

function stopUsbServer() {
  usbClients.forEach(ws => ws.terminate());
  usbClients.clear();
  if (usbWss) { usbWss.close(); usbWss = null; }
  if (usbServer) { usbServer.close(); usbServer = null; }
}

// Setup ADB reverse for a device so phone's localhost:USB_PORT → desktop
function setupAdbReverse(serial) {
  const bin = findAdbBin();
  execFile(bin, ['-s', serial, 'reverse', `tcp:${USB_PORT}`, `tcp:${USB_PORT}`], (err, stdout) => {
    if (err) console.error('ADB reverse failed:', err.message);
    else console.log(`ADB reverse set for ${serial}: phone localhost:${USB_PORT} → desktop:${USB_PORT}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3069');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  initAdb();
  startWifiServer();
  startUsbServer();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  stopWifiServer();
  stopUsbServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── ADB Initialization ───────────────────────────────────────────────────────
function findAdbBin() {
  const candidates = [
    '/usr/local/bin/adb',
    '/opt/homebrew/bin/adb',
    `${os.homedir()}/Library/Android/sdk/platform-tools/adb`,
    '/usr/local/lib/android/sdk/platform-tools/adb',
    '/opt/android-sdk/platform-tools/adb',
    'adb', // fallback: rely on PATH
  ];
  for (const p of candidates) {
    try { if (p === 'adb' || fs.existsSync(p)) return p; } catch (_) {}
  }
  return 'adb';
}

function initAdb() {
  try {
    const { Adb } = require('@devicefarmer/adbkit');
    const bin = findAdbBin();
    console.log('Using ADB at:', bin);
    adbClient = Adb.createClient({ bin });
    console.log('ADB client initialized');
    startDeviceWatcher();
  } catch (err) {
    console.error('ADB init failed:', err.message);
  }
}

let knownDeviceSerials = new Set();

function startDeviceWatcher() {
  if (!adbClient) return;
  setInterval(async () => {
    try {
      const devices = await adbClient.listDevices();
      // Auto-setup adb reverse for newly connected devices
      devices.forEach(d => {
        if (d.type === 'device' && !knownDeviceSerials.has(d.id)) {
          knownDeviceSerials.add(d.id);
          setupAdbReverse(d.id);
        }
      });
      // Clean up disconnected
      const currentIds = new Set(devices.map(d => d.id));
      knownDeviceSerials.forEach(id => { if (!currentIds.has(id)) knownDeviceSerials.delete(id); });

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('adb:devices-changed', devices.map(d => ({
          id: d.id, type: d.type, serial: d.id,
        })));
      }
    } catch (_) {}
  }, 2000);
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('adb:list-devices', async () => {
  if (!adbClient) return { error: 'ADB not available. Make sure ADB is installed.' };
  try {
    const devices = await adbClient.listDevices();
    return devices.map(d => ({ id: d.id, type: d.type, serial: d.id }));
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('adb:list-files', async (_, { serial, remotePath }) => {
  if (!adbClient) return { error: 'ADB not available' };
  try {
    const device = adbClient.getDevice(serial);
    const files = await device.readdir(remotePath || '/storage/emulated/0');
    return files.map(f => ({
      name: f.name,
      size: f.size,
      isDirectory: f.isDirectory ? f.isDirectory() : false,
      isFile: f.isFile ? f.isFile() : true,
      mtime: (() => { try { if (!f.mtime) return null; const d = f.mtime instanceof Date ? f.mtime : new Date(f.mtime); return isNaN(d.getTime()) ? null : d.toISOString(); } catch { return null; } })(),
      mode: f.mode,
    }));
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('adb:get-device-info', async (_, { serial }) => {
  if (!adbClient) return { error: 'ADB not available' };
  try {
    const device = adbClient.getDevice(serial);
    const props = await device.getProperties();
    return {
      model: props['ro.product.model'] || 'Unknown',
      manufacturer: props['ro.product.manufacturer'] || 'Unknown',
      androidVersion: props['ro.build.version.release'] || 'Unknown',
      serial,
    };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('adb:transfer-file', async (event, { serial, remotePath, fileName, saveTo }) => {
  if (!adbClient) return { error: 'ADB not available' };
  try {
    const device = adbClient.getDevice(serial);
    const destDir = saveTo || path.join(os.homedir(), 'Downloads', 'USB Transfer');

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destPath = path.join(destDir, fileName);
    const transfer = await device.pull(remotePath);

    return new Promise((resolve, reject) => {
      let transferred = 0;
      const writeStream = fs.createWriteStream(destPath);

      transfer.on('progress', (stats) => {
        transferred = stats.bytesTransferred;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('transfer:progress', {
            remotePath,
            bytesTransferred: stats.bytesTransferred,
          });
        }
      });

      transfer.on('end', () => {
        resolve({ success: true, destPath, bytesTransferred: transferred });
      });

      transfer.on('error', (err) => {
        reject({ error: err.message });
      });

      transfer.pipe(writeStream);
    });
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('adb:pick-save-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: path.join(os.homedir(), 'Downloads'),
    title: 'Choose save location',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('adb:open-save-folder', async (_, { folderPath }) => {
  const { shell } = require('electron');
  const target = folderPath || path.join(os.homedir(), 'Downloads', 'USB Transfer');
  shell.openPath(target);
  return true;
});

ipcMain.handle('adb:default-save-path', () => {
  return path.join(os.homedir(), 'Downloads', 'USB Transfer');
});

ipcMain.handle('fs:read-file', async (_, { filePath }) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('report:generate', async (_, { data }) => {
  try {
    const saveDir = path.join(os.homedir(), 'Downloads', 'USB Transfer');
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportFileName = `holter_report_${timestamp}.html`;
    const reportPath = path.join(saveDir, reportFileName);

    const patient = data.patient || {};
    const events = data.arrhythmiaEvents || [];

    const eventsRows = events.map(e =>
      `<tr>
        <td>${e.timestamp}</td>
        <td>${e.type}</td>
        <td>${e.hr} bpm</td>
        <td>${e.duration}</td>
      </tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Holter Monitor Report</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; max-width: 900px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #1a5c2a; border-bottom: 2px solid #1a5c2a; padding-bottom: 8px; }
    h2 { color: #1a5c2a; margin-top: 30px; }
    .meta { color: #555; font-size: 13px; margin-bottom: 24px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px; }
    .summary-card { background: #f0faf4; border: 1px solid #b2d8be; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-card .value { font-size: 28px; font-weight: bold; color: #1a5c2a; }
    .summary-card .label { font-size: 12px; color: #555; margin-top: 4px; }
    .patient-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; }
    .patient-grid div { padding: 8px 12px; background: #f9f9f9; border-radius: 6px; font-size: 13px; }
    .patient-grid span { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #1a5c2a; color: white; padding: 10px 12px; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .footer { margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
  </style>
</head>
<body>
  <h1>Holter Monitor Report</h1>
  <p class="meta">Generated: ${new Date().toLocaleString()} | Source: ${data.filePath || 'N/A'}</p>

  <h2>Patient Information</h2>
  <div class="patient-grid">
    <div><span>Name:</span> ${patient.name || 'N/A'}</div>
    <div><span>Age:</span> ${patient.age || 'N/A'}</div>
    <div><span>Recording Date:</span> ${patient.recordingDate || 'N/A'}</div>
    <div><span>Device ID:</span> ${patient.deviceId || 'N/A'}</div>
    <div><span>Duration:</span> ${patient.duration || data.duration || 'N/A'}</div>
    <div><span>Sample Rate:</span> ${patient.sampleRate || 'N/A'}</div>
  </div>

  <h2>Heart Rate Summary</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="value">${data.avgHR || '—'}</div>
      <div class="label">Avg Heart Rate (bpm)</div>
    </div>
    <div class="summary-card">
      <div class="value">${data.minHR || '—'}</div>
      <div class="label">Min Heart Rate (bpm)</div>
    </div>
    <div class="summary-card">
      <div class="value">${data.maxHR || '—'}</div>
      <div class="label">Max Heart Rate (bpm)</div>
    </div>
  </div>

  <h2>Arrhythmia Events</h2>
  ${events.length === 0 ? '<p>No arrhythmia events detected.</p>' : `
  <table>
    <thead>
      <tr><th>Timestamp</th><th>Event Type</th><th>Heart Rate</th><th>Duration</th></tr>
    </thead>
    <tbody>${eventsRows}</tbody>
  </table>`}

  <div class="footer">
    HolterSync &mdash; Holter Monitor Data Acquisition System &mdash; For demonstration purposes only. Not for clinical use.
  </div>
</body>
</html>`;

    fs.writeFileSync(reportPath, html, 'utf8');

    const { shell } = require('electron');
    shell.openPath(reportPath);

    return { success: true, reportPath };
  } catch (err) {
    return { error: err.message };
  }
});

// ── WiFi IPC Handlers ─────────────────────────────────────────────────────────
ipcMain.handle('wifi:get-info', () => {
  const ip = getLocalIP();
  return {
    ip,
    port: WIFI_PORT,
    url: `http://${ip}:${WIFI_PORT}`,
    wsUrl: `ws://${ip}:${WIFI_PORT}/ws`,
    active: !!wifiServer,
    clients: wifiClients.size,
  };
});

ipcMain.handle('wifi:get-qr', async () => {
  const QRCode = require('qrcode');
  const ip = getLocalIP();
  const url = `http://${ip}:${WIFI_PORT}`;
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 200, margin: 1,
      color: { dark: '#00ff88', light: '#0a0a0a' },
    });
    return { dataUrl, url };
  } catch (err) {
    return { error: err.message };
  }
});

// ADB over WiFi helpers
ipcMain.handle('wifi:adb-enable', async (_, { serial }) => {
  const bin = findAdbBin();
  return new Promise((resolve) => {
    execFile(bin, ['-s', serial, 'tcpip', '5555'], (err, stdout, stderr) => {
      if (err) resolve({ error: err.message });
      else resolve({ success: true, message: 'ADB WiFi mode enabled on port 5555. Disconnect USB and connect via IP.' });
    });
  });
});

ipcMain.handle('wifi:adb-connect', async (_, { ip }) => {
  const bin = findAdbBin();
  return new Promise((resolve) => {
    execFile(bin, ['connect', `${ip}:5555`], (err, stdout) => {
      if (err) resolve({ error: err.message });
      else if (stdout.includes('connected') || stdout.includes('already')) resolve({ success: true, message: stdout.trim() });
      else resolve({ error: stdout.trim() });
    });
  });
});

ipcMain.handle('wifi:get-phone-ip', async (_, { serial }) => {
  const bin = findAdbBin();
  return new Promise((resolve) => {
    execFile(bin, ['-s', serial, 'shell', 'ip', 'route'], (err, stdout) => {
      if (err) { resolve({ error: err.message }); return; }
      const match = stdout.match(/src (\d+\.\d+\.\d+\.\d+)/);
      resolve(match ? { ip: match[1] } : { error: 'Could not get phone IP' });
    });
  });
});

// ── Bluetooth IPC Handlers ────────────────────────────────────────────────────
ipcMain.handle('bt:list-devices', async () => {
  // Uses system blueutil (macOS) or bluetoothctl (Linux)
  return new Promise((resolve) => {
    exec('which blueutil', (err) => {
      if (err) {
        // blueutil not installed
        exec('system_profiler SPBluetoothDataType -json 2>/dev/null', (e, stdout) => {
          if (e) return resolve({ error: 'Install blueutil: brew install blueutil' });
          try {
            const data = JSON.parse(stdout);
            const items = data?.SPBluetoothDataType?.[0]?.device_connected || [];
            const devices = items.map(d => {
              const name = Object.keys(d)[0];
              return { name, address: d[name]?.device_address || '', connected: true };
            });
            resolve(devices);
          } catch { resolve({ error: 'Could not parse Bluetooth devices' }); }
        });
        return;
      }
      exec('blueutil --connected --format json', (e2, stdout2) => {
        if (e2) return resolve([]);
        try { resolve(JSON.parse(stdout2)); }
        catch { resolve([]); }
      });
    });
  });
});

ipcMain.handle('bt:get-mac-address', async () => {
  return new Promise((resolve) => {
    exec('system_profiler SPBluetoothDataType 2>/dev/null | grep "Address:"', (err, stdout) => {
      if (err) resolve({ error: 'Could not get BT address' });
      else {
        const match = stdout.match(/Address:\s+([0-9a-fA-F:-]+)/);
        resolve({ address: match ? match[1] : 'Unknown' });
      }
    });
  });
});

// ── USB Live IPC Handlers ─────────────────────────────────────────────────────
ipcMain.handle('usb-live:get-info', () => ({
  port: USB_PORT,
  url: `http://localhost:${USB_PORT}`,
  clients: usbClients.size,
}));

ipcMain.handle('usb-live:get-qr', async (_, { serial }) => {
  const QRCode = require('qrcode');
  // Setup reverse again to be sure
  if (serial) setupAdbReverse(serial);
  const url = `http://localhost:${USB_PORT}`;
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 200, margin: 1,
      color: { dark: '#6366f1', light: '#0a0a0a' },
    });
    return { dataUrl, url };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('usb-live:setup-reverse', (_, { serial }) => {
  setupAdbReverse(serial);
  return { success: true };
});

// ── Bluetooth SPP Serial Port ─────────────────────────────────────────────────
let btSerialPort = null;

ipcMain.handle('bt:list-serial-ports', async () => {
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    return ports.map(p => ({ path: p.path, manufacturer: p.manufacturer || '' }));
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('bt:start-listen', async (_, { portPath }) => {
  try {
    const { SerialPort } = require('serialport');
    const { ReadlineParser } = require('@serialport/parser-readline');

    if (btSerialPort && btSerialPort.isOpen) {
      btSerialPort.close();
      btSerialPort = null;
    }

    const path = portPath || '/dev/tty.Bluetooth-Incoming-Port';
    btSerialPort = new SerialPort({ path, baudRate: 9600, autoOpen: false });

    btSerialPort.open((err) => {
      if (err) {
        console.error('BT serial open error:', err.message);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('bt:error', { message: err.message });
        }
        return;
      }
      console.log('BT serial port opened:', path);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bt:connected', { path });
      }
    });

    const parser = btSerialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', (line) => {
      const text = line.toString().trim();
      if (!text) return;
      console.log('BT received:', text);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bt:data-received', {
          type: 'text',
          payload: text,
          ts: Date.now(),
        });
      }
    });

    btSerialPort.on('close', () => {
      console.log('BT serial port closed');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bt:disconnected', {});
      }
    });

    btSerialPort.on('error', (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bt:error', { message: err.message });
      }
    });

    return { success: true, path };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('bt:stop-listen', () => {
  if (btSerialPort && btSerialPort.isOpen) {
    btSerialPort.close();
    btSerialPort = null;
  }
  return { success: true };
});
