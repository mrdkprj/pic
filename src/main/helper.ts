import { BrowserWindow } from "electron"
import path from "path"
import { Labels } from "../constants";

export default class Helper{

    createMainWindow(config:Pic.Config){
        const mainWindow = new BrowserWindow({
            width: config.bounds.width,
            height: config.bounds.height,
            x:config.bounds.x,
            y:config.bounds.y,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload:MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
            },
            autoHideMenuBar: true,
            show: false,
            icon: path.join(__dirname, "..", "static", "img", "icon.ico"),
            frame: false
        });

        mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

        return mainWindow;

    }

    createMoveFileWindow(parent:BrowserWindow){
        const widow = new BrowserWindow({
            parent:parent,
            modal:true,
            autoHideMenuBar: true,
            show: false,
            frame: false,
            center:true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload:FILE_WINDOW_PRELOAD_WEBPACK_ENTRY
            },
        });

        widow.loadURL(FILE_WINDOW_WEBPACK_ENTRY)

        return widow;
    }

    createEditWindow(){
        const widow = new BrowserWindow({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload:EDIT_WINDOW_PRELOAD_WEBPACK_ENTRY
            },
            autoHideMenuBar: true,
            show: false,
            icon: path.join(__dirname, "..", "static", "img", "icon.ico"),
            frame: false
        });

        widow.loadURL(EDIT_WINDOW_WEBPACK_ENTRY)

        return widow;
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
                name:"Orientation",
                label: Labels.Orientation,
                submenu: this.orientationSubMenu()
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

    private orientationSubMenu():Pic.ContextMenu[]{

        const name = "Orientation"
        return [
            {
                name,
                label:Labels.OrientationNormal,
                type:"radio",
                checked:true,
                value: "Normal"
            },
            {
                name,
                label:Labels.OrientationFlip,
                type:"radio",
                value: "Flip"
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