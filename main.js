const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn, execFile } = require('child_process');
const net = require('net');
const os = require('os');
const path = require('path');

let win, streamProcess;
const ffmpegCandidates = () => process.platform === 'win32'
  ? [path.join(process.resourcesPath, 'ffmpeg.exe'), 'ffmpeg.exe', 'ffmpeg']
  : [path.join(process.resourcesPath, 'ffmpeg'), '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'ffmpeg'];

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1040, minHeight: 680,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#090d14',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
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

async function findFfmpeg() {
  for (const candidate of ffmpegCandidates()) {
    const ok = await new Promise(resolve => execFile(candidate, ['-version'], { timeout: 2500 }, e => resolve(!e)));
    if (ok) return candidate;
  }
  return null;
}

ipcMain.handle('ffmpeg-status', async () => ({ installed: !!(await findFfmpeg()), platform: process.platform }));
ipcMain.handle('install-ffmpeg', async () => {
  if (process.platform === 'darwin') {
    spawn('open', ['-a', 'Terminal', path.join(__dirname, 'renderer/install-ffmpeg-mac.command')], { detached: true });
    return { ok: true };
  }
  shell.openExternal('https://www.gyan.dev/ffmpeg/builds/');
  return { ok: true, manual: true };
});

function safeTarget(server, key) {
  const url = server.endsWith('/') ? server + key : server + '/' + key;
  return url.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll("'", "\\'");
}

ipcMain.handle('start-stream', async (_, config) => {
  if (streamProcess) return { ok: false, error: 'Une diffusion est déjà active.' };
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) return { ok: false, error: 'FFmpeg est introuvable.' };
  const active = config.destinations.filter(d => d.enabled && d.server && d.key);
  if (!active.length) return { ok: false, error: 'Aucune destination complète.' };
  const tee = active.map(d => `[f=flv:onfail=ignore]${safeTarget(d.server, d.key)}`).join('|');
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
  streamProcess = spawn(ffmpeg, args, { windowsHide: true });
  streamProcess.stderr.on('data', data => win?.webContents.send('stream-log', data.toString()));
  streamProcess.on('exit', code => { streamProcess = null; win?.webContents.send('stream-ended', code); });
  return { ok: true, pid: streamProcess.pid };
});

ipcMain.handle('stop-stream', () => {
  if (streamProcess) process.platform === 'win32' ? spawn('taskkill', ['/pid', String(streamProcess.pid), '/t', '/f']) : streamProcess.kill('SIGINT');
  return { ok: true };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (streamProcess) streamProcess.kill(); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
