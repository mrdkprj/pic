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
                "chgConfigFlip",
                "removeHistory"
            ];
          if (validChannels.includes(channel)) {
              ipcRenderer.send(channel, data);
          }
      },

      receive: (channel, func) => {
          let validChannels = ["config", "afterfetch", "afterSave", "afterToggleMaximize", "onError"];
          if (validChannels.includes(channel)) {
              // Deliberately strip event as it includes `sender`
              ipcRenderer.on(channel, (event, ...args) => func(...args));
          }
      }
  }
);