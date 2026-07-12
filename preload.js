const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('centauri', {
  discover: () => ipcRenderer.invoke('discover'),
  probe: ip => ipcRenderer.invoke('probe', ip),
  ffmpegStatus: () => ipcRenderer.invoke('ffmpeg-status'),
  installFfmpeg: () => ipcRenderer.invoke('install-ffmpeg'),
  start: config => ipcRenderer.invoke('start-stream', config),
  stop: () => ipcRenderer.invoke('stop-stream'),
  onLog: cb => ipcRenderer.on('stream-log', (_, value) => cb(value)),
  onEnded: cb => ipcRenderer.on('stream-ended', (_, value) => cb(value))
  ,onInstallLog: cb => ipcRenderer.on('ffmpeg-install-log', (_, value) => cb(value))
  ,onInstallEnded: cb => ipcRenderer.on('ffmpeg-install-ended', (_, value) => cb(value))
});
