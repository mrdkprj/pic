import {app, ipcMain, dialog, shell, protocol, IpcMainEvent} from "electron"
import path from "path";
import fs from "fs/promises"
import proc from "child_process";
import url from "url"
import Config from "./config";
import Util from "./util";
import Helper from "./helper";
import { MainContextMenuTypes } from "./enum";

const renderers:Renderer = {
    Main:null,
    File:null,
    Edit:null,
}

protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { bypassCSP: true } }
])

const targetfiles:Pic.ImageFile[] = [];
const util = new Util();
const config = new Config(app.getPath("userData"));
const ORIENTATIONS = {none:1, flip:3};
const helper = new Helper();
let topRendererName:RendererName = "Main"
let currentIndex = 0;
let directLaunch = false;
let doflip = false;

config.init();

const mainContext = helper.createMainContextMenu(config.data, mainContextMenuCallback)

function mainContextMenuCallback(menu:MainContextMenuTypes, args?:any){
    switch(menu){
        case MainContextMenuTypes.OpenFile:
            onOpen();
            break;
        case MainContextMenuTypes.Reveal:
            onReveal();
            break;
        case MainContextMenuTypes.Reload:
            loadImage(targetfiles[currentIndex].fullPath);
            break;
        case MainContextMenuTypes.History:
            respond("Main", "open-history", null);
            break;
        case MainContextMenuTypes.Mode:
            toggleMode(args);
            break;
        case MainContextMenuTypes.Orientaion:
            toggleOrientation(args)
            break;
        case MainContextMenuTypes.Theme:
            toggleTheme(args);
            break;
    }
}

app.on("ready", () => {

    directLaunch = process.argv.length > 1 && process.argv[1] != ".";

    init();

    renderers.Main = helper.createMainWindow(config.data);
    renderers.File = helper.createMoveFileWindow(renderers.Main);
    renderers.Edit = helper.createEditWindow(renderers.Main)

    protocol.registerFileProtocol("app", (request, callback) => {

        const filePath = url.fileURLToPath(
            "file://" + request.url.slice("app://".length),
        );

        callback(filePath);
    });

    renderers.Main.on("ready-to-show", () => {
        if(config.data.isMaximized){
            renderers.Main.maximize();
        }
        renderers.Main.setBounds(config.data.bounds)

        onReady();
    })

    renderers.Main.on("maximize", onMaximize)
    renderers.Edit.on("maximize", onMaximize)
    renderers.Main.on("unmaximize", onUnmaximize);
    renderers.Edit.on("unmaximize", onUnmaximize);

    renderers.Main.on("closed", () => {
        renderers.Main = null;
    });

    renderers.Edit.on("closed", () => {
        renderers.Edit = null;
    });

});

function init(){

    currentIndex = 0;

    targetfiles.length = 0;

    registerIpcChannels();

}

function registerIpcChannels(){

    const handlers:IpcMainHandler[] = [
        {channel:"minimize", handle:minimize},
        {channel:"toggle-maximize", handle:toggleMaximize},
        {channel:"open-main-context", handle:onOpenMainContext},
        {channel:"close", handle:onClose},
        {channel:"drop-file", handle:onDropFile},
        {channel:"fetch-image", handle:onFetchImage},
        {channel:"delete", handle:onDelete},
        {channel:"pin", handle:onPin},
        {channel:"rotate", handle:onRotate},
        {channel:"restore", handle:onRestore},
        {channel:"remove-history", handle:onRemoveHistory},
        {channel:"toggle-fullscreen", handle:onToggleFullscreen},
        {channel:"open-edit-dialog", handle:openEditDialog},
        {channel:"close-edit-dialog", handle:onCloseEditDialog},
        {channel:"resize", handle:onResizeRequest},
        {channel:"clip", handle:onClipRequest},
        {channel:"save-image", handle:onSaveImageRequest},
        {channel:"set-category", handle:onSetCategory},
        {channel:"open-file-dialog", handle:onOpenFileDialog},
        {channel:"close-file-dialog", handle:onCloseFileDialog},
        {channel:"restart", handle:restart},
    ]

    handlers.forEach(handler => ipcMain.on(handler.channel, (event, request) => handler.handle(event, request)));
}

const respond = <T extends Pic.Args>(rendererName:RendererName, channel:RendererChannel, data:T) => {
    renderers[rendererName].webContents.send(channel, data);
}

function onReady(){

    renderers.Main.show();

    respond<Pic.Config>("Main", "config-loaded", config.data)

    if(directLaunch && targetfiles.length == 0){
        loadImage(process.argv[1]);
        return;
    }

    if(targetfiles.length > 0){
        sendImageData();
        return;
    }

    if(config.data.fullPath){

        const fileExists = util.exists(config.data.fullPath);

        if(fileExists){
            loadImage(config.data.fullPath);
        }
    }
}

const getCurrentImageFile = ():Pic.ImageFile => {

    if(targetfiles[currentIndex]) return targetfiles[currentIndex];

    return null;
}

const loadImage = async (fullPath:string) => {

    const targetFile = path.basename(fullPath);
    const directory = path.dirname(fullPath);

    targetfiles.length = 0;

    const allDirents = await fs.readdir(directory, {withFileTypes: true});

    const fileNames = allDirents.filter(dirent => util.isImageFile(dirent)).map(({ name }) => name);

    fileNames.sort(util.sortByName).forEach((file, index) => {
        if(targetFile == file){
            currentIndex = index;
        }
        targetfiles.push(util.toImageFile(path.join(directory, file)));
    })

    sendImageData();
}

const loadImages = async (directory:string) => {

    targetfiles.length = 0;
    currentIndex = 0;

    const allDirents = await fs.readdir(directory, {withFileTypes: true});

    const fileNames = allDirents.filter(dirent => util.isImageFile(dirent)).map(({ name }) => name);

    fileNames.sort(util.sortByName).forEach(file => {
        targetfiles.push(util.toImageFile(path.join(directory, file)));
    })

    sendImageData();
}

const sendImageData = async (angle?:number) => {

    const imageFile = getCurrentImageFile();

    imageFile.exists = util.exists(imageFile.fullPath);

    const result:Pic.FetchResult = {
        image: imageFile,
        counter: (currentIndex + 1) + " / " + targetfiles.length,
        pinned: config.data.history[imageFile.directory] && config.data.history[imageFile.directory] == imageFile.fileName,
    }

    if(!imageFile.exists){
        return respond<Pic.FetchResult>("Main", "after-fetch", result);
    }

    if(!angle){
        imageFile.detail.orientation = await util.getOrientation(imageFile.fullPath);

        if(doflip && imageFile.detail.orientation != ORIENTATIONS.flip){
            await rotate(ORIENTATIONS.flip);
            imageFile.detail.orientation = ORIENTATIONS.flip;
        }

    }

    if(!imageFile.detail.width){
        const metadata = await util.getMetadata(imageFile.fullPath);
        imageFile.detail.width = metadata.width;
        imageFile.detail.height = metadata.height;
    }

    respond<Pic.FetchResult>("Main", "after-fetch", result);

}

const sendError = (ex:Error) => {
    respond<Pic.ErrorArgs>("Main", "error", {message:ex.message});
}

const onOpenMainContext = () => {
    mainContext.popup({window:renderers.Main})
}

const rotate = async (orientation:number) => {

    const imageFile = getCurrentImageFile();

    if(!imageFile || !imageFile.exists) return;

    try{

        util.rotate(imageFile.fullPath, orientation)

        imageFile.detail.orientation = orientation;

    }catch(ex:any){
        sendError(ex);
    }

}

const deleteFile = async () => {

    const imageFile = getCurrentImageFile();

    if(!imageFile || !imageFile.exists){
        sendImageData();
        return;
    }

    try{

        await shell.trashItem(getCurrentImageFile().fullPath)

        targetfiles.splice(currentIndex, 1);

        if(currentIndex > 0){
            currentIndex--;
        }

        if(targetfiles.length - 1 > currentIndex){
            currentIndex++;
        }

        sendImageData();

    }catch(ex:any){
        sendError(ex);
    }
}

const restoreFile = (data:Pic.RestoreRequest) => {

    if(util.exists(data.fullPath)){

        loadImage(data.fullPath);
        return;
    }

    const directory = path.dirname(data.fullPath)

    if(util.exists(directory)){
        loadImages(directory);
        return;
    }

    reconstructHistory(directory);

}

const reconstructHistory = (directory:string) => {

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

const removeHistory = (file:string) => {
    reconstructHistory(path.dirname(file));
    respond<Pic.RemoveHistoryResult>("Main", "after-remove-history", {history:config.data.history});
}

const clip = async (request:Pic.ClipRequest) => {

    try{

        const imageFile = request.image;
        const input = imageFile.exists ? imageFile.fullPath : Buffer.from(imageFile.fullPath, "base64")
        const result = await util.clipBuffer(input, request.rect);

        const image:Pic.ImageFile = {
            fullPath:result.toString('base64'),
            fileName:imageFile.fileName,
            directory:imageFile.directory,
            exists:false,
            detail:{width:request.rect.width, height:request.rect.height, orientation:imageFile.detail.orientation}
        }

        respond<Pic.EditResult>("Edit", "after-edit", {image})

    }catch(ex:any){
        respond<Pic.EditResult>("Edit", "after-edit", {image:null, message:ex.message})
    }
}

const resize = async (request:Pic.ResizeRequest) => {

    try{

        const imageFile = request.image;
        const input = imageFile.exists ? imageFile.fullPath : Buffer.from(imageFile.fullPath, "base64")
        const size = {
            width: Math.floor(imageFile.detail.width * request.scale),
            height: Math.floor(imageFile.detail.height * request.scale)
        }

        const result = await util.resizeBuffer(input, size);

        const image:Pic.ImageFile = {
            fullPath:result.toString('base64'),
            fileName:imageFile.fileName,
            directory:imageFile.directory,
            exists:false,
            detail:{width:size.width, height:size.height, orientation:imageFile.detail.orientation}
        }

        respond<Pic.EditResult>("Edit", "after-edit", {image})

    }catch(ex:any){
        respond<Pic.EditResult>("Edit", "after-edit", {image:null, message:ex.message})
    }


}

const saveImage = async (request:Pic.SaveImageRequest) => {

    if(request.image.exists) return;

    let savePath = getCurrentImageFile().fullPath;

    if(request.saveCopy){
        const ext = path.extname(request.image.fileName);
        const fileName = request.image.fileName.replace(ext, "")
        const saveFileName = `${fileName}-${new Date().getTime()}${ext}`

        savePath = dialog.showSaveDialogSync(renderers.Edit, {
            defaultPath: path.join(request.image.directory, saveFileName),
            filters: [
                { name: "Image", extensions: ["jpeg", "jpg"] },
            ],
        })

        if(!savePath) return;
    }

    try{
        await fs.writeFile(savePath, request.image.fullPath, "base64");
        const image = request.image;
        image.fullPath = savePath;
        image.directory = path.dirname(savePath);
        image.fileName = path.basename(savePath);
        image.exists = true;
        respond<Pic.SaveImageResult>("Edit", "after-save-image", {image:request.image, success:true})
    }catch(ex:any){
        respond<Pic.SaveImageResult>("Edit", "after-save-image", {image:request.image, success:false})
    }

}



const save = () => {

    config.data.isMaximized = renderers.Main.isMaximized();

    if(!config.data.isMaximized){
        config.data.bounds = renderers.Main.getBounds()
    }

    try{
        config.save();

    }catch(ex:any){
        return sendError(ex);
    }
}

const saveHistory = () => {

    const imageFile = getCurrentImageFile();

    if(!imageFile) return;

    config.data.fullPath = imageFile.fullPath;
    config.data.directory = path.dirname(config.data.fullPath);
    config.data.history[path.dirname(config.data.fullPath)] = path.basename(config.data.fullPath);

}

const toggleMaximize = () => {

    const renderer = topRendererName === "Main" ? renderers.Main : renderers.Edit

    if(renderer.isMaximized()){
        renderer.unmaximize();
        renderer.setBounds(config.data.bounds)
    }else{
        config.data.bounds = renderer.getBounds();
        renderer.maximize();
    }
}

const minimize = () => {
    const renderer = topRendererName === "Main" ? renderers.Main : renderers.Edit
    renderer.minimize();
}

const onUnmaximize:handler<Pic.Request> = () => {
    config.data.isMaximized = false;
    respond<Pic.Config>(topRendererName, "after-toggle-maximize", config.data)
}

const onMaximize:handler<Pic.Request> = () => {
    config.data.isMaximized = true;
    respond<Pic.Config>(topRendererName, "after-toggle-maximize", config.data)
}

const changeTopRenderer = (name:RendererName) => {

    topRendererName = name;

    const topRenderer = topRendererName === "Main" ? renderers.Main : renderers.Edit;
    const hiddenRenderer = topRendererName === "Main" ? renderers.Edit : renderers.Main;

    topRenderer.setBounds(config.data.bounds);

    if(config.data.isMaximized){
        topRenderer.maximize();
    }

    hiddenRenderer.hide()
    topRenderer.show();

}

const onClose:handler<Pic.Request> = async () => {

    const imageFile = getCurrentImageFile();

    if(imageFile && config.data.history[imageFile.directory]){
        saveHistory();
    }

    save();

    renderers.Edit.close();
    renderers.Main.close();
}

const onDropFile:handler<Pic.DropRequest> = async (_event:IpcMainEvent, data:Pic.DropRequest) => await loadImage(data.fullPath)

const onFetchImage:handler<Pic.FetchRequest> = (_event:IpcMainEvent, data:any) => {

    if(targetfiles.length <= 0){
        return sendImageData();
    }

    if(data.index == 1 && targetfiles.length - 1 <= currentIndex){
        return sendImageData();
    }

    if(data.index == -1 && currentIndex <= 0){
        return sendImageData();
    }

    if(data.index == 0){
        currentIndex = 0;
    }else{
        currentIndex += data.index;
    }

    sendImageData();

}

const onDelete:handler<Pic.Request> = async () => await deleteFile()



const onReveal = () => {

    const imageFile = getCurrentImageFile();

    if(!imageFile) return;

    proc.exec(`explorer /e,/select, ${imageFile.fullPath}`);

}

const onOpen = async () => {

    const result = await dialog.showOpenDialog(renderers.Main, {
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
        loadImage(file);
    }

}

const onPin:handler<Pic.Request> = () => {

    const imageFile = getCurrentImageFile();

    if(!imageFile) return;

    saveHistory()
    respond<Pic.PinResult>("Main", "after-pin", {success:true, history:config.data.history});

}

const onRestore = (_event:IpcMainEvent, data:Pic.RestoreRequest) => restoreFile(data)

const onRotate:handler<Pic.RotateRequest> = async (_event:IpcMainEvent, data:Pic.RotateRequest) => {

    await rotate(data.orientation);
    sendImageData(data.orientation);

}

const toggleOrientation = async (orientation:Pic.Orientaion) => {

    doflip = orientation === "Flip";

    const angle = doflip ? ORIENTATIONS.flip : ORIENTATIONS.none;

    if(targetfiles.length > 0){
        await rotate(angle)
        sendImageData();
    }
}

const toggleMode = (mode:Pic.Mode) => {
    config.data.preference.mode = mode;
    respond<Pic.ChangePreferenceArgs>("Main", "toggle-mode", {preference:config.data.preference})
}

const toggleTheme = (theme:Pic.Theme) => {
    config.data.preference.theme = theme;
    respond<Pic.ChangePreferenceArgs>("Main", "toggle-theme", {preference:config.data.preference})
}

const onRemoveHistory:handler<Pic.RemoveHistoryRequest> = (_event:IpcMainEvent, data:Pic.RemoveHistoryRequest) => removeHistory(data.fullPath)

const onToggleFullscreen:handler<Pic.Request> = () => {

    if(renderers.Main.isFullScreen()){
        renderers.Main.setFullScreen(false)
    }else{
        renderers.Main.setFullScreen(true)
    }
}

const onClipRequest:handler<Pic.ClipRequest> = (_event:IpcMainEvent, data:Pic.ClipRequest) => clip(data)
const onResizeRequest:handler<Pic.ResizeRequest> = (_event:IpcMainEvent, data:Pic.ResizeRequest) => resize(data)
const onSaveImageRequest:handler<Pic.SaveImageRequest> = async (_event:IpcMainEvent, data:Pic.SaveImageRequest) => await saveImage(data);

const openEditDialog:handler<Pic.Request> = () => {

    respond<Pic.OpenEditArg>("Edit", "edit-dialog-opened", {file:getCurrentImageFile(), config:config.data})

    changeTopRenderer("Edit")
}

const onCloseEditDialog:handler<Pic.Request> = () => changeTopRenderer("Main");

const restart:handler<Pic.Request> = () => {
    renderers.Main.reload();
    renderers.Edit.reload();
}

const onSetCategory:handler<Pic.CategoryArgs> = (_event:IpcMainEvent, data:Pic.CategoryArgs) => {
    if(data.category){
        targetfiles[currentIndex].detail.category = data.category;
    }else{
        targetfiles[currentIndex].detail.category = null;
    }
}

const onOpenFileDialog:handler<any> = () => {
    const files = targetfiles.filter(file => file.detail.category);
    if(files.length > 0){
        respond<Pic.OpenFileDialogArgs>("File", "prepare-file-dialog", {files});
        renderers.File.show()
    }
}

const onCloseFileDialog:handler<any> = () => renderers.File.hide();