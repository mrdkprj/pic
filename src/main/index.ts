import {app, ipcMain, dialog, shell, protocol, IpcMainEvent} from "electron"
import path from "path";
import fs from "fs/promises"
import proc from "child_process";
import url from "url"
import Config from "./config";
import Util, { EmptyImageFile } from "./util";
import Helper from "./helper";
import { OrientationName, MainContextMenuTypes } from "../constants";

const Renderers:Renderer = {
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
const helper = new Helper();
let topRendererName:RendererName = "Main"
let currentIndex = 0;
let directLaunch = false;

const mainContextMenuCallback = (menu:MainContextMenuTypes, args?:any) => {
    switch(menu){
        case MainContextMenuTypes.OpenFile:
            onOpen();
            break;
        case MainContextMenuTypes.Reveal:
            onReveal();
            break;
        case MainContextMenuTypes.History:
            respond("Main", "open-history", null);
            break;
        case MainContextMenuTypes.ShowActualSize:
            respond("Main", "show-actual-size", null);
            break;
        case MainContextMenuTypes.ToFirst:
            fetchFirst();
            break;
        case MainContextMenuTypes.ToLast:
            fetchLast();
            break;
        case MainContextMenuTypes.Sort:
            sortImageFiles(args, getCurrentImageFile().fileName);
            break;
        case MainContextMenuTypes.Mode:
            toggleMode(args);
            break;
        case MainContextMenuTypes.Orientaion:
            changeOrientaionMode(args)
            break;
        case MainContextMenuTypes.Theme:
            toggleTheme(args);
            break;
        case MainContextMenuTypes.Reload:
            loadImage(getCurrentImageFile().fullPath);
            break;
    }
}

const mainContext = helper.createMainContextMenu(config.data, mainContextMenuCallback)

app.on("ready", () => {

    directLaunch = process.argv.length > 1 && process.argv[1] != ".";

    currentIndex = 0;

    targetfiles.length = 0;

    registerIpcChannels();

    Renderers.Main = helper.createMainWindow(config.data);
    Renderers.File = helper.createMoveFileWindow(Renderers.Main);
    Renderers.Edit = helper.createEditWindow()

    protocol.registerFileProtocol("app", (request, callback) => {

        const filePath = url.fileURLToPath(
            "file://" + request.url.slice("app://".length),
        );

        callback(filePath);
    });

    Renderers.Main.on("ready-to-show", () => {
        if(config.data.isMaximized){
            Renderers.Main.maximize();
        }
        Renderers.Main.setBounds(config.data.bounds)

        onReady();
    })

    Renderers.Main.on("maximize", onMaximize)
    Renderers.Edit.on("maximize", onMaximize)
    Renderers.Main.on("unmaximize", onUnmaximize);
    Renderers.Edit.on("unmaximize", onUnmaximize);

    Renderers.Main.on("closed", () => {
        Renderers.Main = null;
    });

    Renderers.Edit.on("closed", () => {
        Renderers.Edit = null;
    });

});

const registerIpcChannels = () => {

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
    Renderers[rendererName].webContents.send(channel, data);
}

const sendError = (ex:Error) => {
    respond<Pic.ErrorArgs>("Main", "error", {message:ex.message});
}

const onReady = () => {

    Renderers.Main.show();

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

    if(!targetfiles.length || currentIndex >= targetfiles.length){
        return EmptyImageFile;
    }

    if(!util.exists(targetfiles[currentIndex].fullPath)){
        return EmptyImageFile;
    }

    return targetfiles[currentIndex];
}

const loadImage = async (fullPath:string) => {

    const targetFile = path.basename(fullPath);
    const directory = path.dirname(fullPath);

    targetfiles.length = 0;

    const allDirents = await fs.readdir(directory, {withFileTypes: true});

    allDirents.filter(dirent => util.isImageFile(dirent)).forEach(({ name }) => targetfiles.push(util.toImageFile(path.join(directory, name))));

    sortImageFiles(config.data.preference.sort, targetFile)

    sendImageData();
}

const loadImages = async (directory:string) => {

    targetfiles.length = 0;
    currentIndex = 0;

    const allDirents = await fs.readdir(directory, {withFileTypes: true});

    allDirents.filter(dirent => util.isImageFile(dirent)).forEach(({ name }) => targetfiles.push(util.toImageFile(path.join(directory, name))));

    sortImageFiles(config.data.preference.sort)

    sendImageData();
}

const sendImageData = async () => {

    const imageFile = getCurrentImageFile();

    const result:Pic.FetchResult = {
        image: imageFile,
        currentIndex: currentIndex + 1,
        fileCount: targetfiles.length,
        pinned: config.data.history[imageFile.directory] && config.data.history[imageFile.directory] == imageFile.fileName,
    }

    if(imageFile.type === "undefined"){
        return respond<Pic.FetchResult>("Main", "after-fetch", result);
    }

    const metadata = await util.getMetadata(imageFile.fullPath);

    imageFile.detail.orientation = metadata.orientation;

    if(config.data.preference.orientation === "Flip" && imageFile.detail.orientation != OrientationName.Clock180deg){
        await rotate(OrientationName.Clock180deg);
        imageFile.detail.orientation = OrientationName.Clock180deg;
    }

    imageFile.detail.width = metadata.width;
    imageFile.detail.height = metadata.height;
    imageFile.detail.renderedWidth = metadata.orientation % 2 === 0 ? metadata.height : metadata.width;
    imageFile.detail.renderedHeight = metadata.orientation % 2 === 0 ? metadata.width : metadata.height;

    respond<Pic.FetchResult>("Main", "after-fetch", result);

}

const fetchImage = (data:Pic.FetchRequest) => {

    if(!targetfiles.length){
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

const fetchFirst = () => {

    if(!targetfiles.length){
        return;
    }

    currentIndex = 0;

    sendImageData();
}

const fetchLast = () => {

    if(!targetfiles.length){
        return;
    }

    currentIndex = targetfiles.length - 1;

    sendImageData();
}

const sortImageFiles = (sortType:Pic.SortType, currentFileName?:string) => {

    if(!targetfiles.length) return;

    util.sort(targetfiles, sortType);

    if(currentFileName){
        currentIndex = targetfiles.findIndex(imageFile => imageFile.fileName === currentFileName);
    }

    config.data.preference.sort = sortType;
}

const onOpenMainContext = () => {
    mainContext.popup({window:Renderers.Main})
}

const rotate = async (orientation:number) => {

    const imageFile = getCurrentImageFile();

    if(imageFile.type === "undefined") return;

    try{

        await util.rotate(imageFile.fullPath, orientation)

        imageFile.detail.orientation = orientation;

    }catch(ex:any){
        sendError(ex);
    }

}

const deleteFile = async () => {

    const imageFile = getCurrentImageFile();

    if(imageFile.type === "undefined"){
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
        const input = imageFile.type === "path" ? imageFile.fullPath : Buffer.from(imageFile.fullPath, "base64")
        const result = await util.clipBuffer(input, request.rect);

        imageFile.fullPath = result.toString('base64'),
        imageFile.type = "buffer",
        imageFile.detail.width = request.rect.width,
        imageFile.detail.height = request.rect.height
        imageFile.detail.renderedWidth = imageFile.detail.orientation % 2 === 0 ? request.rect.height : request.rect.width;
        imageFile.detail.renderedHeight = imageFile.detail.orientation % 2 === 0 ? request.rect.width : request.rect.height;

        respond<Pic.EditResult>("Edit", "after-edit", {image:imageFile})

    }catch(ex:any){
        respond<Pic.EditResult>("Edit", "after-edit", {image:null, message:ex.message})
    }
}

const resize = async (request:Pic.ResizeRequest) => {

    try{

        const imageFile = request.image;
        const input = imageFile.type === "path" ? imageFile.fullPath : Buffer.from(imageFile.fullPath, "base64")

        const result = await util.resizeBuffer(input, request.size);

        imageFile.fullPath = result.toString('base64'),
        imageFile.type = "buffer",
        imageFile.detail.width = request.size.width,
        imageFile.detail.height = request.size.height
        imageFile.detail.renderedWidth = imageFile.detail.orientation % 2 === 0 ? request.size.height : request.size.width;
        imageFile.detail.renderedHeight = imageFile.detail.orientation % 2 === 0 ? request.size.width : request.size.height;

        respond<Pic.EditResult>("Edit", "after-edit", {image:imageFile})

    }catch(ex:any){
        respond<Pic.EditResult>("Edit", "after-edit", {image:null, message:ex.message})
    }


}

const saveImage = async (request:Pic.SaveImageRequest) => {

    if(request.image.type === "path") return;

    let savePath = getCurrentImageFile().fullPath;

    if(request.saveCopy){
        const ext = path.extname(request.image.fileName);
        const fileName = request.image.fileName.replace(ext, "")
        const saveFileName = `${fileName}-${new Date().getTime()}${ext}`

        savePath = dialog.showSaveDialogSync(Renderers.Edit, {
            defaultPath: path.join(request.image.directory, saveFileName),
            filters: [
                { name: "Image", extensions: ["jpeg", "jpg"] },
            ],
        })

        if(!savePath) return respond<Pic.SaveImageResult>("Edit", "after-save-image", {image:request.image});
    }

    try{
        await fs.writeFile(savePath, request.image.fullPath, "base64");
        const modifiedDate = new Date(request.image.timestamp);
        await fs.utimes(savePath, modifiedDate, modifiedDate);
        const image = request.image;
        image.fullPath = savePath;
        image.directory = path.dirname(savePath);
        image.fileName = path.basename(savePath);
        image.type = "path"
        respond<Pic.SaveImageResult>("Edit", "after-save-image", {image:request.image})
        loadImage(targetfiles[currentIndex].fullPath)
    }catch(ex:any){
        respond<Pic.SaveImageResult>("Edit", "after-save-image", {image:request.image, message:ex.message})
    }

}

const save = () => {

    config.data.isMaximized = Renderers.Main.isMaximized();

    if(!config.data.isMaximized){
        config.data.bounds = Renderers.Main.getBounds()
    }

    try{
        config.save();

    }catch(ex:any){
        return sendError(ex);
    }
}

const saveHistory = () => {

    const imageFile = getCurrentImageFile();

    if(!imageFile.fullPath) return;

    config.data.fullPath = imageFile.fullPath;
    config.data.directory = path.dirname(config.data.fullPath);
    config.data.history[path.dirname(config.data.fullPath)] = path.basename(config.data.fullPath);

}

const toggleMaximize = () => {

    const renderer = topRendererName === "Main" ? Renderers.Main : Renderers.Edit

    if(renderer.isMaximized()){
        renderer.unmaximize();
        renderer.setBounds(config.data.bounds)
    }else{
        config.data.bounds = renderer.getBounds();
        renderer.maximize();
    }
}

const minimize = () => {
    const renderer = topRendererName === "Main" ? Renderers.Main : Renderers.Edit
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

    const topRenderer = topRendererName === "Main" ? Renderers.Main : Renderers.Edit;
    const hiddenRenderer = topRendererName === "Main" ? Renderers.Edit : Renderers.Main;

    topRenderer.setBounds(config.data.bounds);

    if(config.data.isMaximized && !topRenderer.isMaximized()){
        topRenderer.maximize();
    }

    if(!config.data.isMaximized && topRenderer.isMaximized()){
        topRenderer.unmaximize();
    }

    hiddenRenderer.hide()
    topRenderer.show();

}

const onClose:handler<Pic.Request> = async () => {

    const imageFile = getCurrentImageFile();

    if(imageFile.fullPath && config.data.history[imageFile.directory]){
        saveHistory();
    }

    save();

    Renderers.Edit.close();
    Renderers.Main.close();
}

const onDropFile:handler<Pic.DropRequest> = async (_event:IpcMainEvent, data:Pic.DropRequest) => await loadImage(data.fullPath)

const onFetchImage:handler<Pic.FetchRequest> = (_event:IpcMainEvent, data:any) => fetchImage(data);

const onDelete:handler<Pic.Request> = async () => await deleteFile()

const onReveal = () => {

    const imageFile = getCurrentImageFile();

    if(!imageFile.fullPath) return;

    proc.exec(`explorer /e,/select, ${imageFile.fullPath}`);

}

const onOpen = async () => {

    const result = await dialog.showOpenDialog(Renderers.Main, {
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

    if(!imageFile.fullPath) return;

    saveHistory()
    respond<Pic.PinResult>("Main", "after-pin", {success:true, history:config.data.history});

}

const onRestore = (_event:IpcMainEvent, data:Pic.RestoreRequest) => restoreFile(data)

const onRotate:handler<Pic.RotateRequest> = async (_event:IpcMainEvent, data:Pic.RotateRequest) => {

    await rotate(data.orientation);
    sendImageData();

}

const changeOrientaionMode = async (orientationName:Pic.Orientaion) => {

    config.data.preference.orientation = orientationName;

    if(!targetfiles.length) return;

    const orientation = orientationName === "Flip" ? OrientationName.Clock180deg : OrientationName.None;

    await rotate(orientation)

    sendImageData();

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

    if(Renderers.Main.isFullScreen()){
        Renderers.Main.setFullScreen(false)
    }else{
        Renderers.Main.setFullScreen(true)
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
    Renderers.Main.reload();
    respond<Pic.OpenEditArg>("Edit", "edit-dialog-opened", {file:getCurrentImageFile(), config:config.data})
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
        Renderers.File.show()
    }
}

const onCloseFileDialog:handler<any> = () => Renderers.File.hide();