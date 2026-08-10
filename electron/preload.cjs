const { contextBridge } = require('electron');

// Expor versão do app para o renderer (útil para debug)
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  appVersion: process.env.npm_package_version || '1.0.0',
});
