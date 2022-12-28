import {app, BrowserWindow, ipcMain, dialog, shell, protocol, IpcMainEvent} from "electron"
import path from "path";
import sharp from "sharp";
import fs from "fs/promises"
import proc from "child_process";
import url from "url"
import Config from "./config";
import Util from "./util";

sharp.cache(false);

protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { bypassCSP: true } }
])

const targetfiles:Pic.ImageFile[] = [];
const util = new Util();
const config = new Config(app.getPath("userData"));
const STATIC = path.join(__dirname, "..", "static")
const NOT_FOUND:Pic.ImageFile = {
    fullPath:path.join(STATIC, "img", "notfound.svg"),
    directory:"",
    fileName:"",
    angle:0
}
const ORIENTATIONS = {none:1, flip:3};

let mainWindow : Electron.CrossProcessExports.BrowserWindow | null;
let currentIndex = 0;
let directLaunch = false;
let doflip = false;

app.on("ready", async () => {

    directLaunch = process.argv.length > 1 && process.argv[1] != ".";

    await init();

    protocol.registerFileProtocol("app", (request, callback) => {

        const filePath = url.fileURLToPath(
            "file://" + request.url.slice("app://".length),
        );

        callback(filePath);
    });

    mainWindow = new BrowserWindow({
        width: config.data.bounds.width,
        height: config.data.bounds.height,
        x:config.data.bounds.x,
        y:config.data.bounds.y,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload:MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
        },
        autoHideMenuBar: true,
        show: false,
        icon: path.join(STATIC, "img", "icon.ico"),
        frame: false
    });

    mainWindow.on("ready-to-show", () => {
        if(config.data.isMaximized){
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

    await config.init();

    currentIndex = 0;

    targetfiles.length = 0;

    registerIpcChannels();

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

async function onReady(){

    mainWindow.show();

    respond<Pic.Config>("config-loaded", config.data)

    if(directLaunch && targetfiles.length == 0){
        loadImage(process.argv[1]);
        return;
    }

    if(targetfiles.length > 0){
        sendImageData(targetfiles[currentIndex]);
        return;
    }

    if(config.data.fullPath){

        const fileExists = await util.exists(config.data.fullPath);

        if(fileExists){
            loadImage(config.data.fullPath);
        }
    }
}

async function loadImage(fullPath:string){

    const targetFile = path.basename(fullPath);
    const directory = path.dirname(fullPath);

    targetfiles.length = 0;

    const allDirents = await fs.readdir(directory, {withFileTypes: true});

    const fileNames = allDirents.filter(dirent => util.isImageFile(dirent)).map(({ name }) => name);

    fileNames.sort(util.sortByName).forEach((file, index) => {
        if(targetFile == file){
            currentIndex = index;
        }
        targetfiles.push(util.getImageFile(path.join(directory, file)));
    })

    sendImageData(targetfiles[currentIndex]);
}

async function loadImages(directory:string){

    targetfiles.length = 0;
    currentIndex = 0;

    const allDirents = await fs.readdir(directory, {withFileTypes: true});

    const fileNames = allDirents.filter(dirent => util.isImageFile(dirent)).map(({ name }) => name);

    fileNames.sort(util.sortByName).forEach(file => {
        targetfiles.push(util.getImageFile(path.join(directory, file)));
    })

    sendImageData(targetfiles[currentIndex]);
}

async function sendImageData(imageFile:Pic.ImageFile, angle?:number){

    const fileExists = await util.exists(imageFile.fullPath);

    if(fileExists && !angle){

        imageFile.angle = (await sharp(imageFile.fullPath).metadata()).orientation;

        if(doflip && imageFile.angle != ORIENTATIONS.flip){
            await rotate(ORIENTATIONS.flip);
            imageFile.angle = ORIENTATIONS.flip;
        }

    }

    NOT_FOUND.directory = imageFile.directory;
    NOT_FOUND.fileName = imageFile.fileName;
    const targetImageFile = fileExists ? imageFile : NOT_FOUND;

    const data :Pic.FetchResult = {
        image:targetImageFile,
        counter: (currentIndex + 1) + " / " + targetfiles.length,
        saved: config.data.history[targetImageFile.directory] && config.data.history[targetImageFile.directory] == targetImageFile.fileName,
    }

    respond<Pic.FetchResult>("after-fetch", data);

}

function sendError(ex:Error){
    respond<Pic.ErrorArgs>("error", {message:ex.message});
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

    if(data.directory && config.data.history[data.directory]){
        file = path.join(data.directory, config.data.history[data.directory]);
    }

    if(!file){
        return sendImageData(targetfiles[currentIndex]);
    }

    const fileExists = await util.exists(file);

    if(fileExists){

        loadImage(file);
        return;
    }

    const targetDir = path.dirname(file);

    const dirExists = await util.exists(targetDir);

    if(dirExists){
        loadImages(targetDir);
        return;
    }

    reconstructHistory(targetDir);

}

function reconstructHistory(directory:string){

    delete config.data.history[directory];

    if(config.data.directory == directory){
        config.data.directory = "";
        config.data.fullPath = "";

        const historyDirectories = Object.keys(config.data.history);
        if(historyDirectories.length > 0){
            const newDirectory = historyDirectories[0];
            config.data.directory = newDirectory;
            config.data.fullPath = config.data.history[newDirectory];
        }
    }

}

function removeHistory(file:string){
    reconstructHistory(path.dirname(file));
    respond<Pic.RemoveHistoryResult>("after-remove-history", {history:config.data.history});
}

async function saveState(data:Pic.SaveRequest, closing:boolean){

    config.data.theme = data.isDark ? "dark" : "light";
    config.data.mode = data.mouseOnly ? "mouse" : "key";
    config.data.isMaximized = mainWindow.isMaximized();
    const bounds = mainWindow.getBounds();
    config.data.bounds.width = bounds.width;
    config.data.bounds.height = bounds.height;
    config.data.bounds.x = bounds.x;
    config.data.bounds.y = bounds.y;

    try{
        await config.save();

        if(closing) return;

        respond<Pic.SaveResult>("after-save", {success:true});

    }catch(ex:any){
        return sendError(ex);
    }
}

function saveHistory(closing:boolean){

    if(targetfiles.length <= 0) return;

    if(closing && !config.data.history[targetfiles[currentIndex].directory]) return;

    config.data.fullPath = targetfiles[currentIndex].fullPath;
    config.data.directory = path.dirname(config.data.fullPath);
    config.data.history[path.dirname(config.data.fullPath)] = path.basename(config.data.fullPath);

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
    config.data.isMaximized = false;
    respond<Pic.Config>("after-toggle-maximize", config.data)
}

const onMaximize = () => {
    config.data.isMaximized = true;
    respond<Pic.Config>("after-toggle-maximize", config.data)
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
        defaultPath: config.data.directory ? config.data.directory :".",
        filters: [
            {name: "Image file", extensions: ["jpeg","jpg","png","ico","gif"]}
        ]
    });

    if(result.filePaths.length == 1){
        const file = result.filePaths[0];
        config.data.directory = path.dirname(file);

        try{
            await config.save();
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

    const angle = doflip ? ORIENTATIONS.flip : ORIENTATIONS.none;

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