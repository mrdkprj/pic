const {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
} = require("electron");

const path = require("path");
const trash = require("trash");
const sharp = require("sharp");
const fs = require("fs").promises;
const proc = require("child_process");

sharp.cache(false);

let mainWindow;
let currentIndex = 0;
let currentDirectory;
let directLaunch;
let config;
let doflip = false;
const targetfiles = [];
const NOT_FOUND = path.join(__dirname, "resources", "notfound.svg");
const orientations = {none:1, flip:3};
const EXTENSIONS = [
    ".jpeg",
    ".jpg",
    ".png",
    ".gif",
    ".svg"
]


app.on("ready", async () => {

    directLaunch = process.argv.length > 1 && process.argv[1] != "main.js";;

    currentDirectory = path.join(app.getPath("userData"), "temp");

    await init();

    mainWindow = new BrowserWindow({
        width: config.bounds.width,
        height: config.bounds.height,
        x:config.bounds.x,
        y:config.bounds.y,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, "preload.js")
        },
        autoHideMenuBar: true,
        show: false,
        icon: "./resources/icon.ico",
        frame: false
    });

    mainWindow.on("ready-to-show", () => {
        if(config.bounds.isMaximized){
            mainWindow.maximize();
        }
        onReady();
    })

    mainWindow.on("closed", function() {
        mainWindow = null;
    });

    mainWindow.loadURL("file://" + __dirname + "/index.html");

});

async function init(){

    await exists(currentDirectory, true);

    const configFilePath = path.join(currentDirectory,"config.json");

    const fileExists = await exists(configFilePath, false);

    if(fileExists){
        const rawData = await fs.readFile(configFilePath, {encoding:"utf8"});
        config = JSON.parse(rawData);
    }else{
        config =  {directory:null,file:null, mode:"key", theme:"light", history:{}, bounds:{width:1200, height:800, isMaximized: false, x:0, y:0}}
        await writeConfig()
    }

    currentIndex = 0;

    targetfiles.length = 0;
}

async function exists(target, createIfNotFound = false){

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

    mainWindow.webContents.send("config", config);

    if(directLaunch && targetfiles.length == 0){
        loadImage(process.argv[1]);
        return;
    }

    if(targetfiles.length > 0){
        respond(targetfiles[currentIndex]);
        return;
    }

    if(config.file){

        await exists(config.file);
        loadImage(config.file);

    }
}

async function loadImage(fullPath){

    const targetFile = path.basename(fullPath);
    const directory = path.dirname(fullPath);

    targetfiles.length = 0;

    const allDirents = await fs.readdir(directory, {withFileTypes: true});

    const fileNames = allDirents.filter(dirent => isImageFile(dirent)).map(({ name }) => name);

    fileNames.sort(sortByName).forEach((file, index) => {
        if(targetFile == file){
            currentIndex = index;
        }
        targetfiles.push(directory + "\\" + file);
    })

    respond(targetfiles[currentIndex]);
}

async function loadImages(directory){

    targetfiles.length = 0;
    currentIndex = 0;

    const allDirents = await fs.readdir(directory, {withFileTypes: true});

    const fileNames = allDirents.filter(dirent => isImageFile(dirent)).map(({ name }) => name);

    fileNames.sort(sortByName).forEach((file, index) => {
        targetfiles.push(directory + "\\" + file);
    })

    respond(targetfiles[currentIndex]);
}

function isImageFile(dirent){

    if(!dirent.isFile()) return false;

    if(!EXTENSIONS.includes(path.extname(dirent.name).toLowerCase())) return false;

    return true;
}

function sortByName(a, b){
    return a.replace(path.extname(a), "") - b.replace(path.extname(b), "");
}

async function respond(filePath, angle){

    if(!filePath){
        mainWindow.webContents.send("afterfetch", null);
        return;
    }

    const fileExists = await exists(filePath);

    let orientation = angle;
    if(fileExists && !angle){

        try{
            orientation = (await sharp(filePath).metadata()).orientation;

            if(doflip && orientation != orientations.flip){
                await rotate(orientations.flip);
                orientation = orientations.flip;
            }
        }catch(ex){
            return sendError(ex);
        }

    }

    const targetFilePath = fileExists ? filePath : NOT_FOUND;

    const fileName = path.basename(filePath);
    const directory = path.dirname(filePath);

    const data = {
        name: fileName,
        dir:  directory,
        fullpath:targetFilePath,
        counter: (currentIndex + 1) + " / " + targetfiles.length,
        angle:orientation,
        saved: config.history[directory] && config.history[directory] ==fileName,
    }

    mainWindow.webContents.send("afterfetch", data);

}

function sendError(ex){
    mainWindow.webContents.send("onError", ex.message);
}

async function writeConfig(){
    try{
        await fs.writeFile(path.join(currentDirectory,"config.json"), JSON.stringify(config));
    }catch(ex){
        sendError(ex);
    }
}

async function rotate(angle){
    try{
        const buffer = await sharp(targetfiles[currentIndex])
                            .withMetadata({orientation: angle})
                            .toBuffer();

        await sharp(buffer).withMetadata().toFile(targetfiles[currentIndex]);

    }catch(ex){
        sendError(ex);
    }
}

async function restoreFile(args){

    let file = args.file;

    if(args.dir && config.history[args.dir]){
        file = path.join(args.dir, config.history[args.dir]);
    }

    if(!file){
        return respond();
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

function reconstructHistory(directory){

    delete config.history[directory];

    if(config.directory == directory){
        config.directory = null;
        config.file = null;

        const historyDirectories = Object.keys(config.history);
        if(historyDirectories.length > 0){
            const newDirectory = historyDirectories[0];
            config.directory = newDirectory;
            config.file = config.history[newDirectory];
        }
    }

    mainWindow.webContents.send("config", config);
}

function removeHistory(file){
    reconstructHistory(path.dirname(file));
}

function toggleMaximize(){

    if(mainWindow.isMaximized()){
        mainWindow.unmaximize();
        config.bounds.isMaximized = false;
    }else{
        mainWindow.maximize();
        config.bounds.isMaximized = true;
    }

    mainWindow.webContents.send("afterToggleMaximize", {isMaximized: config.bounds.isMaximized});
}

async function save(args, saveOnly = false){

    if(targetfiles.length > 0){

        if(saveOnly && !config.history[path.dirname(targetfiles[currentIndex])]){
            return;
        }

        config.file = targetfiles[currentIndex];
        config.directory = path.dirname(config.file);
        config.history[path.dirname(config.file)] = path.basename(config.file);
    }

    config.theme = args.isDark ? "dark" : "light";
    config.mode = args.mouseOnly ? "mouse" : "key";
    config.bounds.isMaximized = mainWindow.isMaximized();
    const bounds = mainWindow.getBounds();
    config.bounds.width = bounds.width;
    config.bounds.height = bounds.height;
    config.bounds.x = bounds.x;
    config.bounds.y = bounds.y;

    try{
        await writeConfig();

        if(saveOnly) return;

        mainWindow.webContents.send("afterSave", config);

    }catch(ex){
        return sendError(ex);
    }
}

async function closeWindow(args){
    await save(args, true);
    mainWindow.close();
}

ipcMain.on("minimize", (event, args) => {
    mainWindow.minimize();
});

ipcMain.on("maximize", (event, args) => {
    toggleMaximize();
});

ipcMain.on("close", (event, args) => {
    closeWindow(args);
});

ipcMain.on("drop", (event, args) => {
    loadImage(args.file);
});

ipcMain.on("fetch", (event, args) => {

    if(targetfiles.length <= 0){
        return respond();
    }

    if(args == 1 && targetfiles.length - 1 <= currentIndex){
        return respond();
    }

    if(args == -1 && currentIndex <= 0){
        return respond();
    }

    if(args == 0){
        currentIndex = 0;
    }else{
        currentIndex += args;
    }

    respond(targetfiles[currentIndex]);

});

ipcMain.on("delete", async (event, args) => {

    if(targetfiles.length <= 0){
        respond();
        return;
    }

    try{

        await trash(targetfiles[currentIndex]);

        targetfiles.splice(currentIndex, 1);

        if(currentIndex > 0){
            currentIndex--;
        }

        if(targetfiles.length - 1 > currentIndex){
            currentIndex++;
        }

        respond(targetfiles[currentIndex]);

    }catch(ex){
        sendError(ex);
    }
});

ipcMain.on("reveal", (event, args) => {

    if(targetfiles.length <= 0){
        return;
    }

    proc.exec("explorer /e,/select," + targetfiles[currentIndex]);

});

ipcMain.on("open", async (event, args) => {

    const result = await dialog.showOpenDialog(null, {
        properties: ["openFile"],
        title: "Select image",
        defaultPath: config.directory ? config.directory :".",
        filters: [
            {name: "image file", extensions: ["jpeg","jpg","png","ico","gif"]}
        ]
    });

    if(result.filePaths.length == 1){
        const file = result.filePaths[0];
        config.directory = path.dirname(file);

        try{
            await writeConfig();
        }catch(ex){
            return sendError(ex);
        }

        loadImage(file);
    }

});

ipcMain.on("save", async (event, args) => {

    save(args);

});

ipcMain.on("restore", async (event, args) => {
    restoreFile(args);
});

ipcMain.on("rotate", async (event, args) => {

    await rotate(args.angle);
    respond(targetfiles[currentIndex], args.angle);

});

ipcMain.on("chgConfigFlip", async (event, args) => {

    doflip = args.flip;

    const angle = doflip ? orientations.flip : orientations.none;

    if(targetfiles.length > 0){
        await rotate(angle)
        respond(targetfiles[currentIndex]);
    }else{
        respond();
    }
});

ipcMain.on("removeHistory", (event, args) => {
    removeHistory(args.file);
})

ipcMain.on("toggle-fullscreen", (e, data) => {
    if(mainWindow.isFullScreen()){
        mainWindow.setFullScreen(false)
    }else{
        mainWindow.setFullScreen(true)
    }
})