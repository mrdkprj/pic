import { app, ipcMain, dialog, shell, protocol, nativeTheme } from "electron";
import path from "path";
import fs from "fs/promises";
import url from "url";
import Settings from "./settings";
import Util from "./util";
import Helper from "./helper";
import { EmptyImageFile, Extensions } from "../constants";

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { bypassCSP: true } }]);

const imageFiles: Pic.ImageFile[] = [];
const util = new Util();
const settings = new Settings(app.getPath("userData"));
const helper = new Helper();

const Renderers: Renderer = {
    Main: undefined,
    Edit: undefined,
};

let topRendererName: RendererName = "Main";
let currentIndex = 0;

const mainContextMenuCallback = (e: Pic.ContextMenuClickEvent) => {
    switch (e.name) {
        case "OpenFile":
            openFile();
            break;
        case "Reveal":
            reveal();
            break;
        case "History":
            respond("Main", "open-history", {});
            break;
        case "ShowActualSize":
            respond("Main", "show-actual-size", {});
            break;
        case "ToFirst":
            fetchFirst();
            break;
        case "ToLast":
            fetchLast();
            break;
        case "Sort":
            sortImageFiles(e.value as Pic.SortType, getCurrentImageFile().fileName);
            break;
        case "Timestamp":
            changeTimestampMode(e.value as Pic.Timestamp);
            break;
        case "Mode":
            toggleMode(e.value as Pic.Mode);
            break;
        case "Theme":
            toggleTheme(e.value as Pic.Theme);
            break;
        case "Reload":
            loadImage(getCurrentImageFile().fullPath);
            break;
    }
};

const mainContext = helper.getContextMenu(settings.data);

app.on("ready", () => {
    nativeTheme.themeSource = settings.data.preference.theme;

    currentIndex = 0;

    imageFiles.length = 0;

    registerIpcChannels();

    Renderers.Main = helper.createMainWindow(settings.data);
    Renderers.Edit = helper.createEditWindow();

    protocol.registerFileProtocol("app", (request, callback) => {
        const filePath = url.fileURLToPath("file://" + request.url.slice("app://".length));

        callback(filePath);
    });

    Renderers.Main.on("ready-to-show", () => {
        if (settings.data.isMaximized) {
            Renderers.Main?.maximize();
        }
        Renderers.Main?.setBounds(settings.data.bounds);

        onReady();
    });

    Renderers.Main.on("maximize", onMaximize);
    Renderers.Edit.on("maximize", onMaximize);
    Renderers.Main.on("unmaximize", onUnmaximize);
    Renderers.Edit.on("unmaximize", onUnmaximize);

    Renderers.Main.on("closed", () => {
        Renderers.Main = undefined;
    });

    Renderers.Edit.on("closed", () => {
        Renderers.Edit = undefined;
    });
});

const respond = <K extends keyof RendererChannelEventMap>(rendererName: RendererName, channel: K, data: RendererChannelEventMap[K]) => {
    Renderers[rendererName]?.webContents.send(channel, data);
};

const showErrorMessage = async (ex: any | string) => {
    if (typeof ex == "string") {
        await dialog.showMessageBox({ type: "error", message: ex });
    } else {
        await dialog.showMessageBox({ type: "error", message: ex.message });
    }
};

const onReady = () => {
    Renderers.Main?.show();

    respond("Main", "ready", { settings: settings.data, menu: mainContext });

    if (process.argv.length > 1 && process.argv[1] != ".") {
        loadImage(process.argv[1]);
        return;
    }

    if (settings.data.fullPath && util.exists(settings.data.fullPath)) {
        loadImage(settings.data.fullPath);
    }
};

const getCurrentImageFile = (): Pic.ImageFile => {
    if (!imageFiles.length) {
        return EmptyImageFile;
    }

    if (!util.exists(imageFiles[currentIndex].fullPath)) {
        return EmptyImageFile;
    }

    return imageFiles[currentIndex];
};

const loadImage = async (fullPath: string) => {
    const targetFile = path.basename(fullPath);
    const directory = path.dirname(fullPath);

    imageFiles.length = 0;

    const allDirents = await fs.readdir(directory, { withFileTypes: true });

    allDirents.filter((dirent) => util.isImageFile(dirent)).forEach(({ name }) => imageFiles.push(util.toImageFile(path.join(directory, name))));

    sortImageFiles(settings.data.preference.sort, targetFile);

    sendImageData();
};

const loadImages = async (directory: string) => {
    imageFiles.length = 0;
    currentIndex = 0;

    const allDirents = await fs.readdir(directory, { withFileTypes: true });

    allDirents.filter((dirent) => util.isImageFile(dirent)).forEach(({ name }) => imageFiles.push(util.toImageFile(path.join(directory, name))));

    sortImageFiles(settings.data.preference.sort);

    sendImageData();
};

const sendImageData = async () => {
    const imageFile = getCurrentImageFile();

    const result: Pic.FetchResult = {
        image: imageFile,
        currentIndex: currentIndex + 1,
        fileCount: imageFiles.length,
        pinned: !!settings.data.history[imageFile.directory] && settings.data.history[imageFile.directory] == imageFile.fileName,
    };

    if (imageFile.type === "undefined") {
        return respond("Main", "after-fetch", result);
    }

    const metadata = await util.getMetadata(imageFile.fullPath);

    imageFile.detail.orientation = metadata.orientation ?? 1;

    const { width = 0, height = 0 } = metadata;

    imageFile.detail.width = width;
    imageFile.detail.height = height;
    const orientation = metadata.orientation ?? 1;
    imageFile.detail.renderedWidth = orientation % 2 === 0 ? height : width;
    imageFile.detail.renderedHeight = orientation % 2 === 0 ? width : height;
    if (path.extname(imageFile.fullPath) == ".ico") {
        imageFile.detail.format = "ico";
    } else {
        imageFile.detail.format = metadata.format;
    }

    respond("Main", "after-fetch", result);
};

const fetchImage = (data: Pic.FetchRequest) => {
    if (!imageFiles.length) {
        return sendImageData();
    }

    if (data.index == 1 && imageFiles.length - 1 <= currentIndex) {
        return sendImageData();
    }

    if (data.index == -1 && currentIndex <= 0) {
        return sendImageData();
    }

    currentIndex += data.index;

    sendImageData();
};

const fetchFirst = () => {
    if (!imageFiles.length) return;

    currentIndex = 0;

    sendImageData();
};

const fetchLast = () => {
    if (!imageFiles.length) return;

    currentIndex = imageFiles.length - 1;

    sendImageData();
};

const sortImageFiles = (sortType: Pic.SortType, currentFileName?: string) => {
    settings.data.preference.sort = sortType;

    if (!imageFiles.length) return;

    util.sort(imageFiles, sortType);

    if (currentFileName) {
        currentIndex = imageFiles.findIndex((imageFile) => imageFile.fileName === currentFileName);
    }
};

const rotate = async (orientation: number) => {
    const imageFile = getCurrentImageFile();

    if (imageFile.type === "undefined") return;

    try {
        const buffer = await util.rotate(imageFile.fullPath, imageFile.detail.orientation, orientation);
        if (settings.data.preference.timestamp == "Normal") {
            util.saveImage(imageFile.fullPath, util.toBase64(buffer));
        } else {
            util.saveImage(imageFile.fullPath, util.toBase64(buffer), imageFile.timestamp);
        }
        imageFile.detail.orientation = orientation;
    } catch (ex: any) {
        showErrorMessage(ex);
    }
};

const deleteFile = async () => {
    const imageFile = getCurrentImageFile();

    if (imageFile.type === "undefined") {
        sendImageData();
        return;
    }

    try {
        await shell.trashItem(getCurrentImageFile().fullPath);

        imageFiles.splice(currentIndex, 1);

        if (currentIndex > 0) {
            currentIndex--;
        }

        if (imageFiles.length - 1 > currentIndex) {
            currentIndex++;
        }

        sendImageData();
    } catch (ex: any) {
        showErrorMessage(ex);
    }
};

const restoreFile = (data: Pic.RestoreRequest) => {
    if (util.exists(data.fullPath)) {
        loadImage(data.fullPath);
        return;
    }

    const directory = path.dirname(data.fullPath);

    if (util.exists(directory)) {
        loadImages(directory);
        return;
    }

    reconstructHistory(directory);
};

const reconstructHistory = (directory: string) => {
    delete settings.data.history[directory];

    if (settings.data.directory == directory) {
        settings.data.directory = "";
        settings.data.fullPath = "";

        const historyDirectories = Object.keys(settings.data.history);
        if (historyDirectories.length > 0) {
            const newDirectory = historyDirectories[0];
            settings.data.directory = newDirectory;
            settings.data.fullPath = settings.data.history[newDirectory];
        }
    }
};

const removeHistory = (data: Pic.RemoveHistoryRequest) => {
    reconstructHistory(path.dirname(data.fullPath));
    respond("Main", "after-remove-history", { history: settings.data.history });
};

const startEditImage = (imageFile: Pic.ImageFile): Pic.EditInput => {
    return { file: imageFile.type === "path" ? imageFile.fullPath : util.fromBase64(imageFile.fullPath), format: imageFile.detail.format };
};

const endEditImage = (result: Buffer, imageFile: Pic.ImageFile, width: number, height: number) => {
    (imageFile.fullPath = util.toBase64(result)), (imageFile.type = "buffer"), (imageFile.detail.width = width), (imageFile.detail.height = height);
    imageFile.detail.renderedWidth = imageFile.detail.orientation % 2 === 0 ? height : width;
    imageFile.detail.renderedHeight = imageFile.detail.orientation % 2 === 0 ? width : height;
    return imageFile;
};

const clip = async (request: Pic.ClipRequest) => {
    const imageFile = request.image;

    try {
        const input = startEditImage(imageFile);
        const result = await util.clipBuffer(input, request.rect);
        const image = endEditImage(result, imageFile, request.rect.width, request.rect.height);

        respond("Edit", "after-edit", { image });
    } catch (ex: any) {
        respond("Edit", "after-edit", { image: imageFile, message: ex.message });
    }
};

const resize = async (request: Pic.ResizeRequest) => {
    const imageFile = request.image;

    try {
        if (request.format) {
            return await convertImage(request.image, request.format);
        }

        const input = startEditImage(imageFile);
        const result = await util.resizeBuffer(input, request.size);
        const image = endEditImage(result, imageFile, request.size.width, request.size.height);
        respond("Edit", "after-edit", { image });
    } catch (ex: any) {
        respond("Edit", "after-edit", { image: imageFile, message: ex.message });
    }
};

const getSaveDestPath = (image: Pic.ImageFile, saveCopy: boolean, format?: Pic.ImageFormat) => {
    if (!Renderers.Edit) return undefined;

    let savePath = getCurrentImageFile().fullPath;

    if (saveCopy) {
        const ext = format ? `.${format}` : path.extname(image.fileName);
        const fileName = image.fileName.replace(ext, "");
        const saveFileName = `${fileName}-${new Date().getTime()}${ext}`;

        savePath =
            dialog.showSaveDialogSync(Renderers.Edit, {
                defaultPath: path.join(image.directory, saveFileName),
                filters: [{ name: "Image", extensions: format ? [format] : ["jpeg", "jpg"] }],
            }) ?? "";
    }

    return savePath;
};

const convertImage = async (image: Pic.ImageFile, format: Pic.ImageFormat) => {
    if (!Renderers.Edit) return;

    const savePath = getSaveDestPath(image, true, format);

    if (!savePath) return respond("Edit", "after-save-image", { image, status: "Cancel" });

    try {
        if (format == "ico") {
            if (settings.data.preference.timestamp == "Normal") {
                util.toIcon(savePath, image.fullPath);
            } else {
                util.toIcon(savePath, image.fullPath, image.timestamp);
            }
        } else {
            const buffer = await util.toBuffer(image, format);
            if (settings.data.preference.timestamp == "Normal") {
                util.saveImage(savePath, util.toBase64(buffer));
            } else {
                util.saveImage(savePath, util.toBase64(buffer), image.timestamp);
            }
        }

        image.fullPath = savePath;
        image.directory = path.dirname(savePath);
        image.fileName = path.basename(savePath);
        image.type = "path";
        respond("Edit", "after-save-image", { image, status: "Done" });
        loadImage(imageFiles[currentIndex].fullPath);
    } catch (ex: any) {
        respond("Edit", "after-save-image", { image, status: "Error", message: ex.message });
    }
};

const saveImage = async (request: Pic.SaveImageRequest) => {
    if (request.image.type === "path") return;

    if (!Renderers.Edit) return;

    if (!request.saveCopy) {
        const result = dialog.showMessageBoxSync(Renderers.Edit, { message: "Overwrite image?", type: "question", buttons: ["OK", "Cancel"] });
        if (result != 0) {
            return respond("Edit", "after-save-image", { image: request.image, status: "Cancel" });
        }
    }

    const savePath = getSaveDestPath(request.image, request.saveCopy);

    if (!savePath) return respond("Edit", "after-save-image", { image: request.image, status: "Cancel" });

    try {
        if (settings.data.preference.timestamp == "Normal") {
            util.saveImage(savePath, request.image.fullPath);
        } else {
            util.saveImage(savePath, request.image.fullPath, request.image.timestamp);
        }
        const image = request.image;
        image.fullPath = savePath;
        image.directory = path.dirname(savePath);
        image.fileName = path.basename(savePath);
        image.type = "path";
        respond("Edit", "after-save-image", { image: request.image, status: "Done" });
        loadImage(imageFiles[currentIndex].fullPath);
    } catch (ex: any) {
        respond("Edit", "after-save-image", { image: request.image, status: "Error", message: ex.message });
    }
};

const saveConfig = () => {
    if (!Renderers.Main) return;

    settings.data.isMaximized = Renderers.Main.isMaximized();

    if (!settings.data.isMaximized) {
        settings.data.bounds = Renderers.Main.getBounds();
    }

    try {
        settings.save();
    } catch (ex: any) {
        return showErrorMessage(ex);
    }
};

const saveHistory = () => {
    const imageFile = getCurrentImageFile();

    if (!imageFile.fullPath) return;

    settings.data.fullPath = imageFile.fullPath;
    settings.data.directory = path.dirname(settings.data.fullPath);
    settings.data.history[path.dirname(settings.data.fullPath)] = path.basename(settings.data.fullPath);
};

const toggleMaximize = () => {
    const renderer = topRendererName === "Main" ? Renderers.Main : Renderers.Edit;

    if (!renderer) return;

    if (renderer.isMaximized()) {
        renderer.unmaximize();
        renderer.setBounds(settings.data.bounds);
    } else {
        settings.data.bounds = renderer.getBounds();
        renderer.maximize();
    }
};

const minimize = () => {
    const renderer = topRendererName === "Main" ? Renderers.Main : Renderers.Edit;

    if (!renderer) return;

    renderer.minimize();
};

const changeTopRenderer = (name: RendererName) => {
    topRendererName = name;

    const topRenderer = topRendererName === "Main" ? Renderers.Main : Renderers.Edit;
    const hiddenRenderer = topRendererName === "Main" ? Renderers.Edit : Renderers.Main;

    topRenderer?.setBounds(settings.data.bounds);

    if (settings.data.isMaximized && !topRenderer?.isMaximized()) {
        topRenderer?.maximize();
    }

    if (!settings.data.isMaximized && topRenderer?.isMaximized()) {
        topRenderer.unmaximize();
    }

    hiddenRenderer?.hide();
    topRenderer?.show();
};

const reveal = () => {
    const imageFile = getCurrentImageFile();

    if (!imageFile.fullPath) return;

    shell.showItemInFolder(imageFile.fullPath);
};

const openFile = async () => {
    if (!Renderers.Main) return;

    const result = await dialog.showOpenDialog(Renderers.Main, {
        properties: ["openFile"],
        title: "Select image",
        defaultPath: settings.data.directory ? settings.data.directory : ".",
        filters: [{ name: "Image file", extensions: Extensions }],
    });

    if (result.filePaths.length == 1) {
        const file = result.filePaths[0];
        settings.data.directory = path.dirname(file);
        loadImage(file);
    }
};

const pin = () => {
    const imageFile = getCurrentImageFile();

    if (!imageFile.fullPath) return;

    saveHistory();
    respond("Main", "after-pin", { success: true, history: settings.data.history });
};

const changeTimestampMode = (timestampMode: Pic.Timestamp) => {
    settings.data.preference.timestamp = timestampMode;
};

const toggleMode = (mode: Pic.Mode) => {
    settings.data.preference.mode = mode;
    respond("Main", "toggle-mode", { preference: settings.data.preference });
};

const toggleTheme = (theme: Pic.Theme) => {
    settings.data.preference.theme = theme;
    nativeTheme.themeSource = settings.data.preference.theme;
};

const onToggleFullscreen = (e: Pic.FullscreenChangeEvent) => {
    if (e.fullscreen) {
        Renderers.Main?.setFullScreen(true);
    } else {
        Renderers.Main?.setFullScreen(false);
        Renderers.Main?.focus();
    }
};

const openEditDialog = () => {
    respond("Edit", "edit-dialog-opened", { file: getCurrentImageFile(), config: settings.data });

    changeTopRenderer("Edit");
};

const onClose = async () => {
    const imageFile = getCurrentImageFile();

    if (imageFile.fullPath && settings.data.history[imageFile.directory]) {
        saveHistory();
    }

    saveConfig();

    Renderers.Edit?.close();
    Renderers.Main?.close();
};

const onUnmaximize = () => {
    settings.data.isMaximized = false;
    respond(topRendererName, "after-toggle-maximize", settings.data);
};

const onMaximize = () => {
    settings.data.isMaximized = true;
    respond(topRendererName, "after-toggle-maximize", settings.data);
};

const onDropRequest = async (data: Pic.DropRequest) => await loadImage(data.fullPath);

const onRotateRequest = async (data: Pic.RotateRequest) => {
    await rotate(data.orientation);
    sendImageData();
};

const onCloseEditDialog = () => changeTopRenderer("Main");

const onRestartRequest = () => {
    Renderers.Main?.reload();
    Renderers.Edit?.reload();
    respond("Edit", "edit-dialog-opened", { file: getCurrentImageFile(), config: settings.data });
};

const showErrorDialog = (e: Pic.ShowDialogRequest) => showErrorMessage(e.message);

const registerIpcChannels = () => {
    const addEventHandler = <K extends keyof MainChannelEventMap>(channel: K, handler: (data: MainChannelEventMap[K]) => void | Promise<void>) => {
        ipcMain.on(channel, (_event, request) => handler(request));
    };

    addEventHandler("minimize", minimize);
    addEventHandler("toggle-maximize", toggleMaximize);
    addEventHandler("menu-click", mainContextMenuCallback);
    addEventHandler("close", onClose);
    addEventHandler("drop-file", onDropRequest);
    addEventHandler("fetch-image", fetchImage);
    addEventHandler("delete", deleteFile);
    addEventHandler("pin", pin);
    addEventHandler("rotate", onRotateRequest);
    addEventHandler("restore", restoreFile);
    addEventHandler("remove-history", removeHistory);
    addEventHandler("toggle-fullscreen", onToggleFullscreen);
    addEventHandler("open-edit-dialog", openEditDialog);
    addEventHandler("close-edit-dialog", onCloseEditDialog);
    addEventHandler("resize", resize);
    addEventHandler("clip", clip);
    addEventHandler("save-image", saveImage);
    addEventHandler("restart", onRestartRequest);
    addEventHandler("error", showErrorDialog);
};
