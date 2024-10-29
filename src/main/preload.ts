import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("api", {
    send: (channel: keyof MainChannelEventMap, data: any) => {
        ipcRenderer.send(channel, data);
    },

    onFileDrop: (files: File[]): string[] => {
        return files.map((file) => webUtils.getPathForFile(file));
    },

    receive: (channel: keyof RendererChannelEventMap, listener: (data?: any) => void) => {
        ipcRenderer.on(channel, (event, ...args) => listener(...args));
    },

    removeAllListeners: (channel: keyof RendererChannelEventMap) => {
        ipcRenderer.removeAllListeners(channel);
    },
});
