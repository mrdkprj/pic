import {app, ipcMain, dialog, shell, protocol, nativeTheme} from "electron"
import path from "path";
import fs from "fs/promises"
import proc from "child_process";
import url from "url"
import Config from "./config";
import Util from "./util";
import Helper from "./helper";
import { OrientationName, MainContextMenuTypes, EmptyImageFile, Extensions } from "../constants";

protocol.registerSchemesAsPrivileged([
    { scheme: "app", privileges: { bypassCSP: true } }
])

const imageFiles:Pic.ImageFile[] = [];
const util = new Util();
const config = new Config(app.getPath("userData"));
const helper = new Helper();

const Renderers:Renderer = {
    Main:undefined,
    File:undefined,
    Edit:undefined,
}

let topRendererName:RendererName = "Main"
let currentIndex = 0;

const mainContextMenuCallback = (menu:MainContextMenuTypes, args?:any) => {
    switch(menu){
        case MainContextMenuTypes.OpenFile:
            openFile();
            break;
        case MainContextMenuTypes.Reveal:
            reveal();
            break;
        case MainContextMenuTypes.History:
            respond("Main", "open-history", {});
            break;
        case MainContextMenuTypes.ShowActualSize:
            respond("Main", "show-actual-size", {});
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
        case MainContextMenuTypes.Timestamp:
            changeTimestampMode(args);
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

    nativeTheme.themeSource = "dark"//config.data.preference.theme;

    currentIndex = 0;

    imageFiles.length = 0;

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
            Renderers.Main?.maximize();
        }
        Renderers.Main?.setBounds(config.data.bounds)

        onReady();
    })

    Renderers.Main.on("maximize", onMaximize)
    Renderers.Edit.on("maximize", onMaximize)
    Renderers.Main.on("unmaximize", onUnmaximize);
    Renderers.Edit.on("unmaximize", onUnmaximize);

    Renderers.Main.on("closed", () => {
        Renderers.Main = undefined;
    });

    Renderers.Edit.on("closed", () => {
        Renderers.Edit = undefined;
    });

});

const registerIpcChannels = () => {

    const addEventHandler = <K extends keyof MainChannelEventMap>(
        channel:K,
        handler: (data: MainChannelEventMap[K]) => void | Promise<void>
    ) => {
        ipcMain.on(channel, (_event, request) => handler(request))
    }

    addEventHandler("minimize", minimize)
    addEventHandler("toggle-maximize", toggleMaximize)
    addEventHandler("open-main-context", openMainContext)
    addEventHandler("close", onClose)
    addEventHandler("drop-file", onDropRequest)
    addEventHandler("fetch-image", fetchImage)
    addEventHandler("delete", deleteFile)
    addEventHandler("pin", pin)
    addEventHandler("rotate", onRotateRequest)
    addEventHandler("restore", restoreFile)
    addEventHandler("remove-history", removeHistory)
    addEventHandler("toggle-fullscreen", onToggleFullscreen)
    addEventHandler("open-edit-dialog", openEditDialog)
    addEventHandler("close-edit-dialog", onCloseEditDialog)
    addEventHandler("resize", resize)
    addEventHandler("clip", clip)
    addEventHandler("save-image", saveImage)
    addEventHandler("set-category", onSetCategory)
    addEventHandler("open-file-dialog", openFileFileDialog)
    addEventHandler("close-file-dialog", onCloseFileDialog)
    addEventHandler("restart", onRestartRequest)

}

const respond = <K extends keyof RendererChannelEventMap>(rendererName:RendererName, channel:K, data:RendererChannelEventMap[K]) => {
    Renderers[rendererName]?.webContents.send(channel, data);
}

const showErrorMessage = (ex:Error) => {
    dialog.showMessageBox({type:"error", message:ex.message})
}

const onReady = () => {

    Renderers.Main?.show();

    respond("Main", "config-loaded", config.data)

    if(process.argv.length > 1 && process.argv[1] != "."){
        loadImage(process.argv[1]);
        return;
    }

    if(config.data.fullPath && util.exists(config.data.fullPath)){
        loadImage(config.data.fullPath);
    }
}

const getCurrentImageFile = ():Pic.ImageFile => {

    if(!imageFiles.length){
        return EmptyImageFile;
    }

    if(!util.exists(imageFiles[currentIndex].fullPath)){
        return EmptyImageFile;
    }

    return imageFiles[currentIndex];
}

const loadImage = async (fullPath:string) => {

    const targetFile = path.basename(fullPath);
    const directory = path.dirname(fullPath);

    imageFiles.length = 0;

    const allDirents = await fs.readdir(directory, {withFileTypes: true});

    allDirents.filter(dirent => util.isImageFile(dirent)).forEach(({ name }) => imageFiles.push(util.toImageFile(path.join(directory, name))));

    sortImageFiles(config.data.preference.sort, targetFile)

    sendImageData();
}

const loadImages = async (directory:string) => {

    imageFiles.length = 0;
    currentIndex = 0;

    const allDirents = await fs.readdir(directory, {withFileTypes: true});

    allDirents.filter(dirent => util.isImageFile(dirent)).forEach(({ name }) => imageFiles.push(util.toImageFile(path.join(directory, name))));

    sortImageFiles(config.data.preference.sort)

    sendImageData();
}

const sendImageData = async () => {

    const imageFile = getCurrentImageFile();

    const result:Pic.FetchResult = {
        image: imageFile,
        currentIndex: currentIndex + 1,
        fileCount: imageFiles.length,
        pinned: !!config.data.history[imageFile.directory] && config.data.history[imageFile.directory] == imageFile.fileName,
    }

    if(imageFile.type === "undefined"){
        return respond("Main", "after-fetch", result);
    }

    const metadata = await util.getMetadata(imageFile.fullPath);

    imageFile.detail.orientation = metadata.orientation ?? 1;

    if(config.data.preference.orientation === "Flip" && imageFile.detail.orientation != OrientationName.Clock180deg){
        await rotate(OrientationName.Clock180deg);
        imageFile.detail.orientation = OrientationName.Clock180deg;
    }

    const {width = 0, height = 0} = metadata;

    imageFile.detail.width = width;
    imageFile.detail.height = height;
    const orientation = metadata.orientation ?? 1;
    imageFile.detail.renderedWidth = orientation % 2 === 0 ? height : width;
    imageFile.detail.renderedHeight = orientation % 2 === 0 ? width : height;

    respond("Main", "after-fetch", result);

}

const fetchImage = (data:Pic.FetchRequest) => {

    if(!imageFiles.length){
        return sendImageData();
    }

    if(data.index == 1 && imageFiles.length - 1 <= currentIndex){
        return sendImageData();
    }

    if(data.index == -1 && currentIndex <= 0){
        return sendImageData();
    }

    currentIndex += data.index;

    sendImageData();
}

const fetchFirst = () => {

    if(!imageFiles.length) return

    currentIndex = 0;

    sendImageData();
}

const fetchLast = () => {

    if(!imageFiles.length) return

    currentIndex = imageFiles.length - 1;

    sendImageData();
}

const sortImageFiles = (sortType:Pic.SortType, currentFileName?:string) => {

    config.data.preference.sort = sortType;

    if(!imageFiles.length) return;

    util.sort(imageFiles, sortType);

    if(currentFileName){
        currentIndex = imageFiles.findIndex(imageFile => imageFile.fileName === currentFileName);
    }

}

const openMainContext = () => {
    if(!Renderers.Main) return;

    mainContext.popup({window:Renderers.Main})
}

const rotate = async (orientation:number) => {

    const imageFile = getCurrentImageFile();

    if(imageFile.type === "undefined") return;

    try{

        const buffer = await util.rotate(imageFile.fullPath, imageFile.detail.orientation, orientation)
        if(config.data.preference.timestamp == "Normal"){
            await util.saveImage(imageFile.fullPath, util.toBase64(buffer))
        }else{
            await util.saveImage(imageFile.fullPath, util.toBase64(buffer), imageFile.timestamp)
        }
        imageFile.detail.orientation = orientation;

    }catch(ex:any){
        showErrorMessage(ex);
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

        imageFiles.splice(currentIndex, 1);

        if(currentIndex > 0){
            currentIndex--;
        }

        if(imageFiles.length - 1 > currentIndex){
            currentIndex++;
        }

        sendImageData();

    }catch(ex:any){
        showErrorMessage(ex);
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

const removeHistory = (data:Pic.RemoveHistoryRequest) => {
    reconstructHistory(path.dirname(data.fullPath));
    respond("Main", "after-remove-history", {history:config.data.history});
}

const startEditImage = (imageFile:Pic.ImageFile) => {
    return imageFile.type === "path" ? imageFile.fullPath : util.fromBase64(imageFile.fullPath)
}

const endEditImage = (result:Buffer, imageFile:Pic.ImageFile, width:number, height:number) => {
    imageFile.fullPath = util.toBase64(result),
    imageFile.type = "buffer",
    imageFile.detail.width = width,
    imageFile.detail.height = height
    imageFile.detail.renderedWidth = imageFile.detail.orientation % 2 === 0 ? height : width;
    imageFile.detail.renderedHeight = imageFile.detail.orientation % 2 === 0 ? width : height;
    return imageFile;
}

const clip = async (request:Pic.ClipRequest) => {

    const imageFile = request.image;

    try{

        const input = startEditImage(imageFile)
        const result = await util.clipBuffer(input, request.rect);
        const image = endEditImage(result, imageFile, request.rect.width, request.rect.height)

        respond("Edit", "after-edit", {image})

    }catch(ex:any){
        respond("Edit", "after-edit", {image:imageFile, message:ex.message})
    }
}

const resize = async (request:Pic.ResizeRequest) => {

    const imageFile = request.image;

    try{

        const input = startEditImage(imageFile)
        const result = await util.resizeBuffer(input, request.size);
        const image = endEditImage(result, imageFile, request.size.width, request.size.height)

        respond("Edit", "after-edit", {image})

    }catch(ex:any){
        respond("Edit", "after-edit", {image:imageFile, message:ex.message})
    }

}

const getSaveDestPath = (request:Pic.SaveImageRequest) => {

    if(!Renderers.Edit) return undefined;

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
        }) ?? ""

    }

    return savePath;

}

const saveImage = async (request:Pic.SaveImageRequest) => {

    if(request.image.type === "path") return;

    const savePath = getSaveDestPath(request)

    if(!savePath) return respond("Edit", "after-save-image", {image:request.image, status:"Cancel"});

    try{

        if(config.data.preference.timestamp == "Normal"){
            util.saveImage(savePath, request.image.fullPath)
        }else{
            util.saveImage(savePath, request.image.fullPath, request.image.timestamp)
        }
        const image = request.image;
        image.fullPath = savePath;
        image.directory = path.dirname(savePath);
        image.fileName = path.basename(savePath);
        image.type = "path"
        respond("Edit", "after-save-image", {image:request.image, status:"Done"})
        loadImage(imageFiles[currentIndex].fullPath)

    }catch(ex:any){
        respond("Edit", "after-save-image", {image:request.image, status:"Error", message:ex.message})
    }

}

const saveConfig = () => {

    if(!Renderers.Main) return;

    config.data.isMaximized = Renderers.Main.isMaximized();

    if(!config.data.isMaximized){
        config.data.bounds = Renderers.Main.getBounds()
    }

    try{
        config.save();

    }catch(ex:any){
        return showErrorMessage(ex);
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

    if(!renderer) return;

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

    if(!renderer) return;

    renderer.minimize();
}

const changeTopRenderer = (name:RendererName) => {

    topRendererName = name;

    const topRenderer = topRendererName === "Main" ? Renderers.Main : Renderers.Edit;
    const hiddenRenderer = topRendererName === "Main" ? Renderers.Edit : Renderers.Main;

    topRenderer?.setBounds(config.data.bounds);

    if(config.data.isMaximized && !topRenderer?.isMaximized()){
        topRenderer?.maximize();
    }

    if(!config.data.isMaximized && topRenderer?.isMaximized()){
        topRenderer.unmaximize();
    }

    hiddenRenderer?.hide()
    topRenderer?.show();

}

const reveal = () => {

    const imageFile = getCurrentImageFile();

    if(!imageFile.fullPath) return;

    proc.exec(`explorer /e,/select, ${imageFile.fullPath}`);

}

const openFile = async () => {

    if(!Renderers.Main) return;

    const result = await dialog.showOpenDialog(Renderers.Main, {
        properties: ["openFile"],
        title: "Select image",
        defaultPath: config.data.directory ? config.data.directory :".",
        filters: [
            {name: "Image file", extensions: Extensions}
        ]
    });

    if(result.filePaths.length == 1){
        const file = result.filePaths[0];
        config.data.directory = path.dirname(file);
        loadImage(file);
    }

}

const pin = () => {

    const imageFile = getCurrentImageFile();

    if(!imageFile.fullPath) return;

    saveHistory()
    respond("Main", "after-pin", {success:true, history:config.data.history});

}

const changeOrientaionMode = async (orientationName:Pic.Orientaion) => {

    config.data.preference.orientation = orientationName;

    if(!imageFiles.length) return;

    const orientation = orientationName === "Flip" ? OrientationName.Clock180deg : OrientationName.None;

    await rotate(orientation)

    sendImageData();

}

const changeTimestampMode = (timestampMode:Pic.Timestamp) => {
    config.data.preference.timestamp = timestampMode
}

const toggleMode = (mode:Pic.Mode) => {
    config.data.preference.mode = mode;
    respond("Main", "toggle-mode", {preference:config.data.preference})
}

const toggleTheme = (theme:Pic.Theme) => {
    config.data.preference.theme = theme;
    nativeTheme.themeSource = config.data.preference.theme;
    respond("Main", "toggle-theme", {preference:config.data.preference})
}

const onToggleFullscreen = (e:Pic.FullscreenChangeEvent) => {

    if(e.fullscreen){
        Renderers.Main?.setFullScreen(true)
    }else{
        Renderers.Main?.setFullScreen(false)
        Renderers.Main?.focus();
    }
}

const openEditDialog = () => {

    respond("Edit", "edit-dialog-opened", {file:getCurrentImageFile(), config:config.data})

    changeTopRenderer("Edit")
}

const onClose = async () => {

    const imageFile = getCurrentImageFile();

    if(imageFile.fullPath && config.data.history[imageFile.directory]){
        saveHistory();
    }

    saveConfig();

    Renderers.Edit?.close();
    Renderers.Main?.close();
}

const onUnmaximize = () => {
    config.data.isMaximized = false;
    respond(topRendererName, "after-toggle-maximize", config.data)
}

const onMaximize = () => {
    config.data.isMaximized = true;
    respond(topRendererName, "after-toggle-maximize", config.data)
}

const onDropRequest = async (data:Pic.DropRequest) => await loadImage(data.fullPath)

const onRotateRequest = async (data:Pic.RotateRequest) => {

    await rotate(data.orientation);
    sendImageData();

}

const onCloseEditDialog = () => changeTopRenderer("Main");

const onRestartRequest = () => {
    Renderers.Main?.reload();
    respond("Edit", "edit-dialog-opened", {file:getCurrentImageFile(), config:config.data})
}

const onSetCategory = (data:Pic.CategoryChangeEvent) => {
    if(data.category){
        imageFiles[currentIndex].detail.category = data.category;
    }else{
        imageFiles[currentIndex].detail.category = undefined;
    }
}

const openFileFileDialog = () => {
    const files = imageFiles.filter(file => file.detail.category);
    if(files.length > 0){
        respond("File", "prepare-file-dialog", {files});
        Renderers.File?.show()
    }
}

const onCloseFileDialog = () => Renderers.File?.hide();