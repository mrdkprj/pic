const {
  contextBridge,
  ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
  "api", {
      send: (channel, data) => {
          // whitelist channels
          let validChannels = [
                "minimize",
                "maximize",
                "close",
                "drop",
                "fetch",
                "delete",
                "reveal",
                "save",
                "restore",
                "open",
                "rotate",
            ];
          if (validChannels.includes(channel)) {
              ipcRenderer.send(channel, data);
          }
      },

      receive: (channel, func) => {
          let validChannels = ["config", "afterfetch", "onError"];
          if (validChannels.includes(channel)) {
              // Deliberately strip event as it includes `sender`
              ipcRenderer.on(channel, (event, ...args) => func(...args));
          }
      }
  }
);