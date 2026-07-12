const { app, BrowserWindow, ipcMain, shell, safeStorage, dialog } = require('electron');
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

let win, streamProcess, installProcess, activeStreamConfig, stopRequested = false, reconnectAttempt = 0, reconnectTimer;
function wingetFFmpegCandidates() {
  if (process.platform !== 'win32') return [];
  const root = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  if (!fs.existsSync(root)) return [];
  try {
    return fs.readdirSync(root, { recursive: true, withFileTypes: true })
      .filter(e => e.isFile() && e.name.toLowerCase() === 'ffmpeg.exe')
      .map(e => path.join(e.parentPath || e.path, e.name));
  } catch { return []; }
}
const ffmpegCandidates = () => process.platform === 'win32'
  ? [path.join(process.resourcesPath, 'ffmpeg.exe'), ...wingetFFmpegCandidates(), 'ffmpeg.exe', 'ffmpeg']
  : [path.join(process.resourcesPath, 'ffmpeg'), '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'ffmpeg'];

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1040, minHeight: 680,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#090d14',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.webContents.on('console-message', (_, level, message) => { if (level >= 2) console.error(`[Renderer] ${message}`); });
  win.loadFile(path.join(__dirname, 'renderer/index.html'));
}

function testPort(host, port, timeout = 650) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let done = false;
    const finish = value => { if (!done) { done = true; socket.destroy(); resolve(value); } };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

function localPrefixes() {
  const prefixes = new Set();
  Object.values(os.networkInterfaces()).flat().filter(Boolean).forEach(i => {
    if (i.family === 'IPv4' && !i.internal && i.address.startsWith('192.168.'))
      prefixes.add(i.address.split('.').slice(0, 3).join('.'));
  });
  return [...prefixes];
}

ipcMain.handle('discover', async () => {
  const found = [];
  for (const prefix of localPrefixes()) {
    for (let start = 1; start < 255; start += 32) {
      const batch = [];
      for (let i = start; i < Math.min(start + 32, 255); i++) {
        const ip = `${prefix}.${i}`;
        batch.push(testPort(ip, 3031).then(ok => { if (ok) found.push({ ip, camera: `http://${ip}:3031/video` }); }));
      }
      await Promise.all(batch);
    }
  }
  return found;
});

ipcMain.handle('probe', async (_, ip) => ({ camera: await testPort(ip, 3031, 1500), control: await testPort(ip, 3030, 1500) }));
ipcMain.handle('choose-recording-folder', async () => {
  let moviesPath; try { moviesPath = app.getPath('movies'); } catch { moviesPath = path.join(os.homedir(), 'Movies'); }
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: moviesPath, title: 'Choisir le dossier des enregistrements' });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('default-recording-folder', () => { try { return app.getPath('movies'); } catch { return path.join(os.homedir(), 'Movies'); } });

async function findFfmpeg() {
  for (const candidate of ffmpegCandidates()) {
    const ok = await new Promise(resolve => execFile(candidate, ['-version'], { timeout: 2500 }, e => resolve(!e)));
    if (ok) return candidate;
  }
  return null;
}

ipcMain.handle('ffmpeg-status', async () => ({ installed: !!(await findFfmpeg()), platform: process.platform }));
ipcMain.handle('secure-storage-status', () => ({ available: safeStorage.isEncryptionAvailable() }));
ipcMain.handle('save-secrets', (_, destinations) => {
  if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: 'Le chiffrement système est indisponible.' };
  const secrets = destinations.map(({ name, key, server, enabled }) => ({ name, key, server, enabled }));
  const encrypted = safeStorage.encryptString(JSON.stringify(secrets));
  fs.writeFileSync(path.join(app.getPath('userData'), 'stream-secrets.bin'), encrypted, { mode: 0o600 });
  return { ok: true };
});
ipcMain.handle('load-secrets', () => {
  const file = path.join(app.getPath('userData'), 'stream-secrets.bin');
  if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(file)) return { ok: true, destinations: [] };
  try { return { ok: true, destinations: JSON.parse(safeStorage.decryptString(fs.readFileSync(file))) }; }
  catch { return { ok: false, error: 'Impossible de déchiffrer les clés enregistrées.' }; }
});
ipcMain.handle('clear-secrets', () => {
  const file = path.join(app.getPath('userData'), 'stream-secrets.bin');
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return { ok: true };
});
ipcMain.handle('install-ffmpeg', async () => {
  if (installProcess) return { ok: false, error: 'Une installation est déjà en cours.' };
  const command = process.platform === 'darwin' ? '/opt/homebrew/bin/brew' : 'winget';
  const args = process.platform === 'darwin'
    ? ['install', 'ffmpeg']
    : ['install', '--exact', '--id', 'Gyan.FFmpeg.Essentials', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity'];
  if (process.platform === 'darwin' && !fs.existsSync(command))
    return { ok: false, error: 'Homebrew est requis. Installez-le depuis brew.sh puis réessayez.' };
  try {
    installProcess = spawn(command, args, { windowsHide: true });
    const relay = data => win?.webContents.send('ffmpeg-install-log', data.toString());
    installProcess.stdout.on('data', relay); installProcess.stderr.on('data', relay);
    installProcess.on('error', error => {
      installProcess = null;
      win?.webContents.send('ffmpeg-install-ended', { ok: false, error: error.message });
    });
    installProcess.on('exit', async code => {
      installProcess = null;
      const installed = !!(await findFfmpeg());
      win?.webContents.send('ffmpeg-install-ended', { ok: code === 0 && installed, code, installed });
    });
    return { ok: true };
  } catch (error) { installProcess = null; return { ok: false, error: error.message }; }
});

function safeTarget(server, key) {
  const url = server.endsWith('/') ? server + key : server + '/' + key;
  return url.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll("'", "\\'");
}

function destinationStates(config, status, detail = '') {
  config.destinations.filter(d => d.enabled && d.server && d.key)
    .forEach(d => win?.webContents.send('destination-state', { name: d.name, status, detail }));
}

async function launchStream(config) {
  if (streamProcess) return { ok: false, error: 'Une diffusion est déjà active.' };
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) return { ok: false, error: 'FFmpeg est introuvable.' };
  const active = config.destinations.filter(d => d.enabled && d.server && d.key);
  if (!active.length && !config.recording?.enabled) return { ok: false, error: 'Aucune destination ou sortie locale active.' };
  const outputs = active.map(d => `[f=flv:onfail=ignore]${safeTarget(d.server, d.key)}`);
  if (config.recording?.enabled && config.recording.path) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(config.recording.path, `Centauri-${stamp}.mkv`);
    const escapedPath = outputPath.replaceAll('\\', '\\\\').replaceAll(':', '\\:').replaceAll('|', '\\|').replaceAll("'", "\\'");
    outputs.push(`[f=matroska:onfail=ignore]${escapedPath}`);
    win?.webContents.send('recording-started', outputPath);
  }
  const tee = outputs.join('|');
  const profiles = {
    economy: { filter: 'scale=854:480:flags=lanczos', bitrate: '1800k', buffer: '3600k' },
    balanced: { filter: 'scale=1280:720:flags=lanczos,eq=contrast=1.04:saturation=1.04,unsharp=5:5:0.35', bitrate: '3500k', buffer: '7000k' },
    studio: { filter: 'scale=1280:720:flags=lanczos,eq=contrast=1.07:brightness=0.012:saturation=1.06,unsharp=5:5:0.5', bitrate: '5000k', buffer: '10000k' }
  };
  const p = profiles[config.profile] || profiles.balanced;
  const args = ['-hide_banner', '-loglevel', 'info', '-thread_queue_size', '512', '-i', config.camera,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-map', '0:v:0', '-map', '1:a:0',
    '-vf', p.filter, '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p',
    '-r', '30', '-g', '60', '-b:v', p.bitrate, '-maxrate', p.bitrate, '-bufsize', p.buffer,
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-f', 'tee', tee];
  destinationStates(config, reconnectAttempt ? 'reconnecting' : 'connecting');
  streamProcess = spawn(ffmpeg, args, { windowsHide: true });
  const launchedProcess = streamProcess;
  streamProcess.stderr.on('data', data => win?.webContents.send('stream-log', data.toString()));
  streamProcess.once('spawn', () => {
    destinationStates(config, 'live');
    win?.webContents.send('stream-reconnected', { attempt: reconnectAttempt });
    setTimeout(() => { if (streamProcess === launchedProcess) reconnectAttempt = 0; }, 15000);
  });
  streamProcess.on('exit', code => {
    streamProcess = null;
    if (!stopRequested && activeStreamConfig && reconnectAttempt < 5) {
      reconnectAttempt += 1;
      const delay = Math.min(2000 * reconnectAttempt, 10000);
      destinationStates(config, 'reconnecting', `Tentative ${reconnectAttempt}/5`);
      win?.webContents.send('stream-reconnecting', { attempt: reconnectAttempt, delay });
      reconnectTimer = setTimeout(() => launchStream(activeStreamConfig), delay);
    } else {
      destinationStates(config, stopRequested ? 'idle' : 'error', stopRequested ? '' : `Code ${code}`);
      activeStreamConfig = null;
      win?.webContents.send('stream-ended', code);
    }
  });
  return { ok: true, pid: streamProcess.pid };
}

ipcMain.handle('start-stream', async (_, config) => {
  stopRequested = false; reconnectAttempt = 0; activeStreamConfig = config;
  return launchStream(config);
});

ipcMain.handle('stop-stream', () => {
  stopRequested = true; activeStreamConfig = null; clearTimeout(reconnectTimer);
  if (streamProcess) process.platform === 'win32' ? spawn('taskkill', ['/pid', String(streamProcess.pid), '/t', '/f']) : streamProcess.kill('SIGINT');
  else win?.webContents.send('stream-ended', 0);
  return { ok: true };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (streamProcess) streamProcess.kill(); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
