import {  Menu, BrowserWindow } from "electron"
import path from "path"
import { MainContextMenuTypes, Labels } from "../constants";

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

    createMainContextMenu(config:Pic.Config, onclick: (menu:MainContextMenuTypes, args?:any) => void){
        const mainContextTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                label: Labels.OpenFile,
                click: () => onclick(MainContextMenuTypes.OpenFile)
            },
            {
                label: Labels.Reveal,
                click: () => onclick(MainContextMenuTypes.Reveal)
            },
            {
                label: Labels.History,
                click: () => onclick(MainContextMenuTypes.History)
            },
            {
                label: Labels.ShowActualSize,
                click: () => onclick(MainContextMenuTypes.ShowActualSize)
            },
            { type: 'separator' },
            {
                label: Labels.MoveFirst,
                click: () => onclick(MainContextMenuTypes.ToFirst)
            },
            {
                label: Labels.MoveLast,
                click: () => onclick(MainContextMenuTypes.ToLast)
            },
            {
                label: Labels.SortBy,
                submenu: this.createSortMenu(config, onclick)
            },
            { type: 'separator' },
            {
                label:Labels.Timestamp,
                submenu: this.timestampSubMenu(config, onclick)
            },
            {
                label: Labels.Mode,
                submenu: this.modeSubMenu(config, onclick)
            },
            {
                label: Labels.Orientation,
                submenu: this.orientationSubMenu(config, onclick)
            },
            {
                label: Labels.Theme,
                submenu: this.themeSubMenu(config, onclick)
            },
            { type: 'separator' },
            {
                label: Labels.Reload,
                click: () => onclick(MainContextMenuTypes.Reload)
            },
        ]

        return Menu.buildFromTemplate(mainContextTemplate)
    }

    private createSortMenu(config:Pic.Config, onclick: (menu:MainContextMenuTypes, args?:Pic.Options) => void){

        const sortMenuTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                id: "NameAsc",
                label: Labels.NameAsc,
                type: "checkbox",
                checked: config.preference.sort === "NameAsc",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Sort, "NameAsc"))
            },
            {
                id: "NameDesc",
                label: Labels.NameDesc,
                type: "checkbox",
                checked: config.preference.sort === "NameDesc",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Sort, "NameDesc"))
            },
            {
                id: "DateAsc",
                label: Labels.DateAsc,
                type: "checkbox",
                checked: config.preference.sort === "DateAsc",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Sort, "DateAsc"))
            },
            {
                id: "DateDesc",
                label: Labels.DateDesc,
                type: "checkbox",
                checked: config.preference.sort === "DateDesc",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Sort, "DateDesc"))
            },
        ]

        return Menu.buildFromTemplate(sortMenuTemplate);
    }

    private timestampSubMenu(config:Pic.Config, onclick: (menu:MainContextMenuTypes, args?:Pic.Options) => void){

        const contextTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                id: "TimestampNormal",
                label:Labels.TimestampNormal,
                type:"checkbox",
                checked: config.preference.timestamp === "Normal",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Timestamp, "Normal"))
            },
            {
                id: "TimestampUnchanged",
                label:Labels.TimestampUnchanged,
                type:"checkbox",
                checked: config.preference.timestamp === "Unchanged",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Timestamp, "Unchanged"))
            },
        ]

        return Menu.buildFromTemplate(contextTemplate);
    }

    private modeSubMenu(config:Pic.Config, onclick: (menu:MainContextMenuTypes, args?:Pic.Options) => void){

        const contextTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                id: "Mouse",
                label:Labels.ModeMouse,
                type:"checkbox",
                checked: config.preference.mode == "Mouse",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Mode, "Mouse"))
            },
            {
                id: "Keyboard",
                label:Labels.ModeKeyboard,
                type:"checkbox",
                checked: config.preference.mode == "Keyboard",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Mode, "Keyboard"))
            },
        ]

        return Menu.buildFromTemplate(contextTemplate);
    }

    private orientationSubMenu(config:Pic.Config, onclick: (menu:MainContextMenuTypes, args?:Pic.Options) => void){

        const contextTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                id: "Normal",
                label:Labels.OrientationNormal,
                type:"checkbox",
                checked:true,
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Orientaion, "Normal"))
            },
            {
                id: "Flip",
                label:Labels.OrientationFlip,
                type:"checkbox",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Orientaion, "Flip"))
            },
        ]

        return Menu.buildFromTemplate(contextTemplate);
    }

    private themeSubMenu(config:Pic.Config, onclick: (menu:MainContextMenuTypes, args?:Pic.Options) => void){

        const contextTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                id: "Light",
                label:Labels.ThemeLight,
                type:"checkbox",
                checked: config.preference.theme == "light",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Theme, "light"))
            },
            {
                id: "Dark",
                label:Labels.ThemeDark,
                type:"checkbox",
                checked: config.preference.theme == "dark",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Theme, "dark"))
            },
        ]

        return Menu.buildFromTemplate(contextTemplate);
    }

    private toggleMenuItemCheckbox(menuItem:Electron.MenuItem, onclick:() => void){

        menuItem.menu.items.forEach((item:Electron.MenuItem) => {
            if(item.id === menuItem.id){
                item.checked = true;
            }else{
                item.checked = false;
            }
        })

        onclick()
    }
}