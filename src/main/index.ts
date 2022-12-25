import {app, BrowserWindow, ipcMain, dialog, shell, protocol, IpcMainEvent} from "electron"
import path from "path";
import sharp from "sharp";
import fs from "fs/promises"
import proc from "child_process";
import { Dirent } from "fs";
import url from "url"
import * as constants from "./constants"

sharp.cache(false);

protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { bypassCSP: true } }
])

const targetfiles:Pic.ImageFile[] = [];

let mainWindow : Electron.CrossProcessExports.BrowserWindow | null;
let currentIndex = 0;
let currentDirectory = "";
let directLaunch = false;
let config:Pic.Config;
let doflip = false;

app.on("ready", async () => {

    directLaunch = process.argv.length > 1 && process.argv[1] != ".";

    currentDirectory = path.join(app.getPath("userData"), "temp");

    await init();

    protocol.registerFileProtocol("app", (request, callback) => {

        const filePath = url.fileURLToPath(
            'file://' + request.url.slice("app://".length),
        );

        callback(filePath);
    });

    mainWindow = new BrowserWindow({
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
        icon: path.join(constants.STATIC, "img", "icon.ico"),
        frame: false
    });

    mainWindow.on("ready-to-show", () => {
        if(config.isMaximized){
            mainWindow.maximize();
        }

        onReady();
    })

    mainWindow.on("maximize", onMaximize)

    mainWindow.on("unmaximize", onMinimize);

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

});

async function init(){

    await exists(currentDirectory, true);

    const configFilePath = path.join(currentDirectory, constants.CONFIG_FILE_NAME);

    const fileExists = await exists(configFilePath, false);

    if(fileExists){

        const rawData = await fs.readFile(configFilePath, {encoding:"utf8"});
        config = createConfig(JSON.parse(rawData))

    }else{

        config = constants.DEFAULT_CONFIG
        await writeConfig()

    }

    currentIndex = 0;

    targetfiles.length = 0;

    registerIpcChannels();

}

function createConfig(rawConfig:any):Pic.Config{

    Object.keys(rawConfig).forEach(key => {
        if(!(key as keyof Pic.Config in constants.DEFAULT_CONFIG)){
            delete rawConfig[key]
        }
    })

    Object.keys(constants.DEFAULT_CONFIG).forEach(key => {
        if(!(key in rawConfig)){
            console.log(key)
            rawConfig[key] = constants.DEFAULT_CONFIG[key as keyof Pic.Config];
        }
    })

    return rawConfig;
}

function registerIpcChannels(){

    const handlers:IpcMainHandler[] = [
        {channel:"minimize", handle:toggleMaximize},
        {channel:"maximize", handle:toggleMaximize},
        {channel:"close", handle:onClose},
        {channel:"drop-file", handle:onDropFile},
        {channel:"fetch-image", handle:onFetchImage},
        {channel:"delete", handle:onDelete},
        {channel:"reveal", handle:onReveal},
        {channel:"save", handle:onSave},
        {channel:"restore", handle:onRestore},
        {channel:"open", handle:onOpen},
        {channel:"rotate", handle:onRotate},
        {channel:"change-flip", handle:onChangeFlip},
        {channel:"remove-history", handle:onRemoveHistory},
        {channel:"toggle-fullscreen", handle:onToggleFullscreen}
    ]

    handlers.forEach(handler => ipcMain.on(handler.channel, (event, request) => handler.handle(event, request)));
}

const respond = <T extends Pic.Args>(channel:RendererChannel, data:T) => {
    mainWindow.webContents.send(channel, data);
}

async function exists(target:string, createIfNotFound = false){

    try{
        await fs.stat(target);

        return true;

    }catch(ex){

        if(createIfNotFound){
            await fs.mkdir(target);
        }

        return false;
    }
}

async function onReady(){

    mainWindow.show();

    respond<Pic.Config>("config-loaded", config)

    if(directLaunch && targetfiles.length == 0){
        loadImage(process.argv[1]);
        return;
    }

    if(targetfiles.length > 0){
        sendImageData(targetfiles[currentIndex]);
        return;
    }

    if(config.fullPath){
        await exists(config.fullPath);
        loadImage(config.fullPath);
    }
}

function getImageFile(filePath:string, angle = 0){

    return {
        fullPath:filePath,
        directory:path.dirname(filePath),
        fileName:path.basename(filePath),
        angle:angle,
    }

}

async function loadImage(fullPath:string){

    const targetFile = path.basename(fullPath);
    const directory = path.dirname(fullPath);

    targetfiles.length = 0;

    const allDirents = await fs.readdir(directory, {withFileTypes: true});

    const fileNames = allDirents.filter(dirent => isImageFile(dirent)).map(({ name }) => name);

    fileNames.sort(sortByName).forEach((file, index) => {
        if(targetFile == file){
            currentIndex = index;
        }
        targetfiles.push(getImageFile(path.join(directory, file)));
    })

    sendImageData(targetfiles[currentIndex]);
}

async function loadImages(directory:string){

    targetfiles.length = 0;
    currentIndex = 0;

    const allDirents = await fs.readdir(directory, {withFileTypes: true});

    const fileNames = allDirents.filter(dirent => isImageFile(dirent)).map(({ name }) => name);

    fileNames.sort(sortByName).forEach(file => {
        targetfiles.push(getImageFile(path.join(directory, file)));
    })

    sendImageData(targetfiles[currentIndex]);
}

function isImageFile(dirent:Dirent){

    if(!dirent.isFile()) return false;

    if(!constants.EXTENSIONS.includes(path.extname(dirent.name).toLowerCase())) return false;

    return true;
}

function sortByName(a:string, b:string){
    return a.replace(path.extname(a), "").localeCompare(b.replace(path.extname(b), ""))
}

async function sendImageData(imageFile:Pic.ImageFile, angle?:number){

    const fileExists = await exists(imageFile.fullPath);

    if(fileExists && !angle){

        imageFile.angle = (await sharp(imageFile.fullPath).metadata()).orientation;

        if(doflip && imageFile.angle != constants.ORIENTATIONS.flip){
            await rotate(constants.ORIENTATIONS.flip);
            imageFile.angle = constants.ORIENTATIONS.flip;
        }

    }

    constants.NOT_FOUND.directory = imageFile.directory;
    constants.NOT_FOUND.fileName = imageFile.fileName;
    const targetImageFile = fileExists ? imageFile : constants.NOT_FOUND;

    const data :Pic.FetchResult = {
        image:targetImageFile,
        counter: (currentIndex + 1) + " / " + targetfiles.length,
        saved: config.history[targetImageFile.directory] && config.history[targetImageFile.directory] == targetImageFile.fileName,
    }

    respond<Pic.FetchResult>("after-fetch", data);

}

function sendError(ex:Error){
    respond<Pic.ErrorArgs>("error", {message:ex.message});
}

async function writeConfig(){
    try{
        await fs.writeFile(path.join(currentDirectory, constants.CONFIG_FILE_NAME), JSON.stringify(config));
    }catch(ex:any){
        sendError(ex);
    }
}

async function rotate(angle:number){

    try{
        const buffer = await sharp(targetfiles[currentIndex].fullPath)
                            .withMetadata({orientation: angle})
                            .toBuffer();

        await sharp(buffer).withMetadata().toFile(targetfiles[currentIndex].fullPath);

        targetfiles[currentIndex].angle = angle;

    }catch(ex:any){
        sendError(ex);
    }

}


async function restoreFile(data:Pic.RestoreRequest){

    let file = data.fullPath;

    if(data.directory && config.history[data.directory]){
        file = path.join(data.directory, config.history[data.directory]);
    }

    if(!file){
        return sendImageData(targetfiles[currentIndex]);
    }

    const fileExists = await exists(file);

    if(fileExists){

        loadImage(file);
        return;
    }

    const targetDir = path.dirname(file);

    const dirExists = await exists(targetDir);

    if(dirExists){
        loadImages(targetDir);
        return;
    }

    reconstructHistory(targetDir);

}

function reconstructHistory(directory:string){

    delete config.history[directory];

    if(config.directory == directory){
        config.directory = "";
        config.fullPath = "";

        const historyDirectories = Object.keys(config.history);
        if(historyDirectories.length > 0){
            const newDirectory = historyDirectories[0];
            config.directory = newDirectory;
            config.fullPath = config.history[newDirectory];
        }
    }

}

function removeHistory(file:string){
    reconstructHistory(path.dirname(file));
    respond<Pic.RemoveHistoryResult>("after-remove-history", {history:config.history});
}

async function saveState(data:Pic.SaveRequest, closing:boolean){

    config.theme = data.isDark ? "dark" : "light";
    config.mode = data.mouseOnly ? "mouse" : "key";
    config.isMaximized = mainWindow.isMaximized();
    const bounds = mainWindow.getBounds();
    config.bounds.width = bounds.width;
    config.bounds.height = bounds.height;
    config.bounds.x = bounds.x;
    config.bounds.y = bounds.y;

    try{
        await writeConfig();

        if(closing) return;

        respond<Pic.SaveResult>("after-save", {success:true});

    }catch(ex:any){
        return sendError(ex);
    }
}

function saveHistory(closing:boolean){

    if(targetfiles.length <= 0) return;

    if(closing && !config.history[targetfiles[currentIndex].directory]) return;

    config.fullPath = targetfiles[currentIndex].fullPath;
    config.directory = path.dirname(config.fullPath);
    config.history[path.dirname(config.fullPath)] = path.basename(config.fullPath);

}

const closeWindow = async (args:Pic.SaveRequest) => {
    saveHistory(true);
    await saveState(args, true);
    mainWindow.close();
}

const toggleMaximize = () => {
    if(mainWindow.isMaximized()){
        mainWindow.unmaximize();
    }else{
        mainWindow.maximize();
    }
}

const onMinimize = () => {
    config.isMaximized = false;
    respond<Pic.Config>("after-toggle-maximize", config)
}

const onMaximize = () => {
    config.isMaximized = true;
    respond<Pic.Config>("after-toggle-maximize", config)
}

const onClose = async (_event:IpcMainEvent, data:Pic.SaveRequest) => await closeWindow(data);
const onDropFile = async (_event:IpcMainEvent, data:Pic.DropRequest) => await loadImage(data.fullPath)

const onFetchImage = (_event:IpcMainEvent, data:Pic.FetchRequest) => {

    if(targetfiles.length <= 0){
        return sendImageData(targetfiles[currentIndex]);
    }

    if(data.index == 1 && targetfiles.length - 1 <= currentIndex){
        return sendImageData(targetfiles[currentIndex]);
    }

    if(data.index == -1 && currentIndex <= 0){
        return sendImageData(targetfiles[currentIndex]);
    }

    if(data.index == 0){
        currentIndex = 0;
    }else{
        currentIndex += data.index;
    }

    sendImageData(targetfiles[currentIndex]);

}

const onDelete = async () => {

    if(targetfiles.length <= 0){
        sendImageData(targetfiles[currentIndex]);
        return;
    }

    try{

        await shell.trashItem(targetfiles[currentIndex].fullPath)

        targetfiles.splice(currentIndex, 1);

        if(currentIndex > 0){
            currentIndex--;
        }

        if(targetfiles.length - 1 > currentIndex){
            currentIndex++;
        }

        sendImageData(targetfiles[currentIndex]);

    }catch(ex:any){
        sendError(ex);
    }
}

const onReveal = async () => {

    if(targetfiles.length <= 0){
        return;
    }

    proc.exec(`explorer /e,/select, ${targetfiles[currentIndex].fullPath}`);

}

const onOpen = async () => {

    if(!mainWindow) return;

    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        title: "Select image",
        defaultPath: config.directory ? config.directory :".",
        filters: [
            {name: "Image file", extensions: ["jpeg","jpg","png","ico","gif"]}
        ]
    });

    if(result.filePaths.length == 1){
        const file = result.filePaths[0];
        config.directory = path.dirname(file);

        try{
            await writeConfig();
        }catch(ex:any){
            return sendError(ex);
        }

        loadImage(file);
    }

}

const onSave = async (_event:IpcMainEvent, data:Pic.SaveRequest) => {
    saveHistory(false)
    saveState(data, false)
}

const onRestore = async (_event:IpcMainEvent, data:Pic.RestoreRequest) => restoreFile(data)

const onRotate = async (_event:IpcMainEvent, data:Pic.RotateRequest) => {

    await rotate(data.orientation);
    sendImageData(targetfiles[currentIndex], data.orientation);

}

const onChangeFlip = async (_event:IpcMainEvent, data:Pic.FlipRequest) => {

    doflip = data.flip;

    const angle = doflip ? constants.ORIENTATIONS.flip : constants.ORIENTATIONS.none;

    if(targetfiles.length > 0){
        await rotate(angle)
        sendImageData(targetfiles[currentIndex]);
    }
}

const onRemoveHistory = async (_event:IpcMainEvent, data:Pic.RemoveHistoryRequest) => removeHistory(data.fullPath)

const onToggleFullscreen = async () => {
    if(mainWindow.isFullScreen()){
        mainWindow.setFullScreen(false)
    }else{
        mainWindow.setFullScreen(true)
    }
}