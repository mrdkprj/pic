import {  Menu, BrowserWindow } from "electron"
import path from "path"
import { MainContextMenuTypes } from "./enum";

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
                label: "Open File",
                click: () => onclick(MainContextMenuTypes.OpenFile)
            },
            {
                label: "Reveal In Explorer",
                click: () => onclick(MainContextMenuTypes.Reveal)
            },
            {
                label: "History",
                click: () => onclick(MainContextMenuTypes.History)
            },
            { type: 'separator' },
            {
                label: "Mode",
                submenu: this.modeSubMenu(config, onclick)
            },
            {
                label: "Orientaion",
                submenu: this.orientationSubMenu(config, onclick)
            },
            {
                label: "Theme",
                submenu: this.themeSubMenu(config, onclick)
            },
            { type: 'separator' },
            {
                label: "Reload",
                click: () => onclick(MainContextMenuTypes.Reload)
            },
        ]

        return Menu.buildFromTemplate(mainContextTemplate)
    }

    private modeSubMenu(config:Pic.Config, onclick: (menu:MainContextMenuTypes, args?:Pic.Options) => void){

        const contextTemplate:Electron.MenuItemConstructorOptions[] = [
            {
                id: "Mouse",
                label:"Mouse",
                type:"checkbox",
                checked: config.preference.mode == "Mouse",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Mode, "Mouse"))
            },
            {
                id: "Keyboard",
                label:"Keyboard",
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
                label:"Normal",
                type:"checkbox",
                checked:true,
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Orientaion, "Normal"))
            },
            {
                id: "Flip",
                label:"Flip",
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
                label:"Light",
                type:"checkbox",
                checked: config.preference.theme == "Light",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Theme, "Light"))
            },
            {
                id: "Dark",
                label:"Dark",
                type:"checkbox",
                checked: config.preference.theme == "Dark",
                click: (menuItem) => this.toggleMenuItemCheckbox(menuItem, () => onclick(MainContextMenuTypes.Theme, "Dark"))
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