const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => 'pong from electron',
})