import { BrowserWindow } from "electron";
import os from "os";
import path from "path";
import { Labels } from "../constants";
import { getDefaultConfig, Menu, MenuItem, MenuItemConstructorOptions } from "wcpopup-node";

const isDev = process.env.NODE_ENV === "development";

const load = (window: BrowserWindow, name: RendererName) => {
    if (isDev) {
        return window.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/${name.toLowerCase()}/index.html`);
    }

    return window.loadFile(path.join(__dirname, `../renderer/${name.toLowerCase()}/index.html`));
};

const getWindowHandle = (window: BrowserWindow) => {
    const hwndBuffer = window.getNativeWindowHandle();
    let hwnd;
    if (os.platform() == "linux") {
        if (os.endianness() == "LE") {
            hwnd = hwndBuffer.readUInt32LE();
        } else {
            hwnd = hwndBuffer.readUInt32BE();
        }
    } else {
        if (os.endianness() == "LE") {
            hwnd = hwndBuffer.readInt32LE();
        } else {
            hwnd = hwndBuffer.readInt32BE();
        }
    }

    return hwnd;
};

const getMenuConfig = (setting: Pic.Settings) => {
    const config = getDefaultConfig();
    config.color.dark.color = "#efefef";
    config.color.dark.backgroundColor = "#202020";
    config.color.dark.hoverBackgroundColor = "#373535";
    config.corner = "Round";
    config.theme = setting.theme == "dark" ? "dark" : "light";
    config.size.borderSize = 1;
    config.font.fontFamily = "Segoe UI";
    config.font.darkFontSize = 12;
    config.font.lightFontSize = 12;
    config.size.itemHorizontalPadding = 20;
    return config;
};

export default class Helper {
    private menu: Menu;

    createMainWindow(config: Pic.Settings) {
        const window = new BrowserWindow({
            width: config.bounds.width,
            height: config.bounds.height,
            x: config.bounds.x,
            y: config.bounds.y,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "../preload/preload.js"),
            },
            autoHideMenuBar: true,
            show: false,
            icon: path.join(__dirname, "..", "static", "img", "icon.ico"),
            frame: false,
        });

        load(window, "Main");

        return window;
    }

    createEditWindow() {
        const window = new BrowserWindow({
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "../preload/preload.js"),
            },
            autoHideMenuBar: true,
            show: false,
            icon: path.join(__dirname, "..", "static", "img", "icon.ico"),
            frame: false,
        });

        load(window, "Edit");

        return window;
    }

    async popup(x: number, y: number) {
        await this.menu.popup(x, y);
    }

    changeTheme(theme: Pic.Theme) {
        this.menu.setTheme(theme);
    }

    createContextMenu(window: BrowserWindow, onClick: Pic.ContextMenuCallback<keyof Pic.ContextMenuSubTypeMap>, config: Pic.Settings) {
        const template: MenuItemConstructorOptions[] = [
            {
                name: "OpenFile",
                label: Labels.OpenFile,
                click: () => onClick("OpenFile"),
            },
            {
                name: "Reveal",
                label: Labels.Reveal,
                click: () => onClick("Reveal"),
            },
            {
                name: "History",
                label: Labels.History,
                click: () => onClick("History"),
            },
            {
                name: "ShowActualSize",
                label: Labels.ShowActualSize,
                click: () => onClick("ShowActualSize"),
            },
            { type: "separator" },
            {
                name: "ToFirst",
                label: Labels.MoveFirst,
                click: () => onClick("ToFirst"),
            },
            {
                name: "ToLast",
                label: Labels.MoveLast,
                click: () => onClick("ToLast"),
            },
            {
                name: "Sort",
                label: Labels.SortBy,
                submenu: this.createSortMenu(onClick, config),
            },
            { type: "separator" },
            {
                name: "Timestamp",
                label: Labels.Timestamp,
                submenu: this.timestampSubMenu(onClick, config),
            },
            {
                name: "Mode",
                label: Labels.Mode,
                submenu: this.modeSubMenu(onClick, config),
            },
            {
                name: "Theme",
                label: Labels.Theme,
                submenu: this.themeSubMenu(onClick, config),
            },
            { type: "separator" },
            {
                name: "Reload",
                label: Labels.Reload,
                click: () => onClick("Reload"),
            },
        ];

        const menu = new Menu();
        menu.buildFromTemplateWithConfig(getWindowHandle(window), template, getMenuConfig(config));
        this.menu = menu;
    }

    private createSortMenu(onClick: Pic.ContextMenuCallback<"Sort">, config: Pic.Settings): MenuItem[] {
        const name = "Sort";
        return [
            {
                name,
                label: Labels.NameAsc,
                type: "radio",
                checked: config.preference.sort === "NameAsc",

                click: () => onClick(name, "NameAsc"),
            },
            {
                name,
                label: Labels.NameDesc,
                type: "radio",
                checked: config.preference.sort === "NameDesc",

                click: () => onClick(name, "NameDesc"),
            },
            {
                name,
                label: Labels.DateAsc,
                type: "radio",
                checked: config.preference.sort === "DateAsc",

                click: () => onClick(name, "DateAsc"),
            },
            {
                name,
                label: Labels.DateDesc,
                type: "radio",
                checked: config.preference.sort === "DateDesc",

                click: () => onClick(name, "DateDesc"),
            },
        ];
    }

    private timestampSubMenu(onClick: Pic.ContextMenuCallback<"Timestamp">, config: Pic.Settings): MenuItem[] {
        const name = "Timestamp";
        return [
            {
                name,
                label: Labels.TimestampNormal,
                type: "radio",
                checked: config.preference.timestamp === "Normal",

                click: () => onClick(name, "Normal"),
            },
            {
                name,
                label: Labels.TimestampUnchanged,
                type: "radio",
                checked: config.preference.timestamp === "Unchanged",

                click: () => onClick(name, "Unchanged"),
            },
        ];
    }

    private modeSubMenu(onClick: Pic.ContextMenuCallback<"Mode">, config: Pic.Settings): MenuItem[] {
        const name = "Mode";
        return [
            {
                name,
                label: Labels.ModeMouse,
                type: "radio",
                checked: config.preference.mode == "Mouse",

                click: () => onClick(name, "Mouse"),
            },
            {
                name,
                label: Labels.ModeKeyboard,
                type: "radio",
                checked: config.preference.mode == "Keyboard",

                click: () => onClick(name, "Keyboard"),
            },
        ];
    }

    private themeSubMenu(onClick: Pic.ContextMenuCallback<"Theme">, config: Pic.Settings): MenuItem[] {
        const name = "Theme";
        return [
            {
                name,
                label: Labels.ThemeLight,
                type: "radio",
                checked: config.preference.theme == "light",

                click: () => onClick(name, "light"),
            },
            {
                name,
                label: Labels.ThemeDark,
                type: "radio",
                checked: config.preference.theme == "dark",

                click: () => onClick(name, "dark"),
            },
        ];
    }
}
