const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('centauri', {
  discover: () => ipcRenderer.invoke('discover'),
  probe: ip => ipcRenderer.invoke('probe', ip),
  chooseRecordingFolder: () => ipcRenderer.invoke('choose-recording-folder'),
  defaultRecordingFolder: () => ipcRenderer.invoke('default-recording-folder'),
  ffmpegStatus: () => ipcRenderer.invoke('ffmpeg-status'),
  secureStorageStatus: () => ipcRenderer.invoke('secure-storage-status'),
  saveSecrets: destinations => ipcRenderer.invoke('save-secrets', destinations),
  loadSecrets: () => ipcRenderer.invoke('load-secrets'),
  clearSecrets: () => ipcRenderer.invoke('clear-secrets'),
  installFfmpeg: () => ipcRenderer.invoke('install-ffmpeg'),
  start: config => ipcRenderer.invoke('start-stream', config),
  stop: () => ipcRenderer.invoke('stop-stream'),
  onLog: cb => ipcRenderer.on('stream-log', (_, value) => cb(value)),
  onEnded: cb => ipcRenderer.on('stream-ended', (_, value) => cb(value))
  ,onDestinationState: cb => ipcRenderer.on('destination-state', (_, value) => cb(value))
  ,onReconnecting: cb => ipcRenderer.on('stream-reconnecting', (_, value) => cb(value))
  ,onReconnected: cb => ipcRenderer.on('stream-reconnected', (_, value) => cb(value))
  ,onRecordingStarted: cb => ipcRenderer.on('recording-started', (_, value) => cb(value))
  ,onInstallLog: cb => ipcRenderer.on('ffmpeg-install-log', (_, value) => cb(value))
  ,onInstallEnded: cb => ipcRenderer.on('ffmpeg-install-ended', (_, value) => cb(value))
});
