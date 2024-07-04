import { BrowserWindow } from "electron"
import path from "path"
import { Labels } from "../constants";

const isDev = process.env.NODE_ENV === "development"

const load = (window:BrowserWindow, name:RendererName) => {

    if(isDev){
        return window.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/${name.toLowerCase()}/index.html`)
    }

    return window.loadFile(path.join(__dirname, `../renderer/${name.toLowerCase()}/index.html`))

}

export default class Helper{

    createMainWindow(config:Pic.Config){
        const window = new BrowserWindow({
            width: config.bounds.width,
            height: config.bounds.height,
            x:config.bounds.x,
            y:config.bounds.y,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "../preload/preload.js"),
            },
            autoHideMenuBar: true,
            show: false,
            icon: path.join(__dirname, "..", "static", "img", "icon.ico"),
            frame: false
        });

        load(window, "Main")

        return window;

    }

    createEditWindow(){
        const window = new BrowserWindow({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "../preload/preload.js"),
            },
            autoHideMenuBar: true,
            show: false,
            icon: path.join(__dirname, "..", "static", "img", "icon.ico"),
            frame: false
        });

        load(window, "Edit")

        return window;
    }

    getContextMenu(config:Pic.Config):Pic.ContextMenu[]{
        return [
            {
                name: "OpenFile",
                label: Labels.OpenFile,
            },
            {
                name: "Reveal",
                label: Labels.Reveal,
            },
            {
                name: "History",
                label: Labels.History,
            },
            {
                name:"ShowActualSize",
                label: Labels.ShowActualSize,
            },
            { name:"None", type: "separator" },
            {
                name: "ToFirst",
                label: Labels.MoveFirst,
            },
            {
                name: "ToLast",
                label: Labels.MoveLast,
            },
            {
                name:"Sort",
                label: Labels.SortBy,
                submenu: this.createSortMenu(config)
            },
            { name:"None", type: "separator" },
            {
                name:"Timestamp",
                label:Labels.Timestamp,
                submenu: this.timestampSubMenu(config)
            },
            {
                name:"Mode",
                label: Labels.Mode,
                submenu: this.modeSubMenu(config)
            },
            {
                name:"Theme",
                label: Labels.Theme,
                submenu: this.themeSubMenu(config)
            },
            { name:"None", type: "separator" },
            {
                name:"Reload",
                label: Labels.Reload,
            },
        ]
    }

    private createSortMenu(config:Pic.Config):Pic.ContextMenu[]{

        const name = "Sort";
        return [
            {
                name,
                label: Labels.NameAsc,
                type: "radio",
                checked: config.preference.sort === "NameAsc",
                value: "NameAsc"
            },
            {
                name,
                label: Labels.NameDesc,
                type: "radio",
                checked: config.preference.sort === "NameDesc",
                value: "NameDesc"
            },
            {
                name,
                label: Labels.DateAsc,
                type: "radio",
                checked: config.preference.sort === "DateAsc",
                value: "DateAsc"
            },
            {
                name,
                label: Labels.DateDesc,
                type: "radio",
                checked: config.preference.sort === "DateDesc",
                value: "DateDesc"
            },
        ]

    }

    private timestampSubMenu(config:Pic.Config,):Pic.ContextMenu[]{

        const name = "Timestamp"
        return [
            {
                name,
                label:Labels.TimestampNormal,
                type:"radio",
                checked: config.preference.timestamp === "Normal",
                value: "Normal"
            },
            {
                name,
                label:Labels.TimestampUnchanged,
                type:"radio",
                checked: config.preference.timestamp === "Unchanged",
                value: "Unchanged"
            },
        ]

    }

    private modeSubMenu(config:Pic.Config):Pic.ContextMenu[]{

        const name = "Mode"
        return [
            {
                name,
                label:Labels.ModeMouse,
                type:"radio",
                checked: config.preference.mode == "Mouse",
                value: "Mouse"
            },
            {
                name,
                label:Labels.ModeKeyboard,
                type:"radio",
                checked: config.preference.mode == "Keyboard",
                value: "Keyboard"
            },
        ]

    }

    private themeSubMenu(config:Pic.Config):Pic.ContextMenu[]{

        const name = "Theme"
        return [
            {
                name,
                label:Labels.ThemeLight,
                type:"radio",
                checked: config.preference.theme == "light",
                value: "light"
            },
            {
                name,
                label:Labels.ThemeDark,
                type:"radio",
                checked: config.preference.theme == "dark",
                value: "dark"
            },
        ]
    }


}