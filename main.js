const {
    app,
    BrowserWindow,
    ipcMain,
    dialog
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

const orientations = {none:1, flip:3};
const targetfiles = [];

app.on("ready", async () => {

    directLaunch = process.argv.length > 1 && process.argv[1] != "main.js";;

    currentDirectory = path.join(app.getPath("userData"), "temp");

    await init();

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
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

    mainWindow.on('ready-to-show', () => {
        onReady();
    })

    mainWindow.on("closed", function() {
        mainWindow = null;
    });

    mainWindow.loadURL("file://" + __dirname + "/index.html");

    mainWindow.maximize();

});

async function init(){

    try{
        await fs.stat(currentDirectory);
    }catch(ex){
        await fs.mkdir(currentDirectory);
    }

    const configFilePath = path.join(currentDirectory,"config.json");

    try{
        await fs.stat(configFilePath);

        const rawData = await fs.readFile(configFilePath, {encoding:"utf8"});
        config = JSON.parse(rawData);

    }catch(ex){
        config =  {directory:null,file:null, mode:"key", flip:false, theme:"light"}
        await writeConfig()
    }

    currentIndex = 0;

    targetfiles.length = 0;
}

function onReady(){

    mainWindow.show();

    mainWindow.webContents.send("config", config);

    if(directLaunch && targetfiles.length == 0){
        loadImage(process.argv[1]);
    }else if(targetfiles.length > 0){
        respond(targetfiles[currentIndex]);
    }
}

async function loadImage(fullPath){

    const targetFile = path.basename(fullPath);
    config.directory = path.dirname(fullPath);
    config.file = fullPath;

    targetfiles.length = 0;

    const allDirents = await fs.readdir(config.directory, {withFileTypes: true});

    const fileNames = allDirents.filter(dirent => dirent.isFile()).map(({ name }) => name);

    fileNames.sort(sortByName).forEach((file, index) => {
        if(targetFile == file){
            currentIndex = index;
        }
        targetfiles.push(config.directory + "\\" + file);
    })

    respond(targetfiles[currentIndex]);
}

function sortByName(a, b){
    return a.replace(path.extname(a), "") - b.replace(path.extname(b), "");
}

async function respond(filePath, angle){

    if(!filePath){
        mainWindow.webContents.send("afterfetch", null);
        return;
    }

    let orientation = angle;
    if(!angle){

        orientation = await (await sharp(filePath).metadata()).orientation;

        if(config.flip && orientation != orientations.flip){
            await rotate(orientations.flip);
            orientation = orientations.flip;
        }

    }

    const data = {
        name: path.basename(filePath),
        path:filePath,
        counter: (currentIndex + 1) + " / " + targetfiles.length,
        angle:orientation,
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

ipcMain.on("minimize", (event, args) => {
    mainWindow.minimize();
});

ipcMain.on("maximize", (event, args) => {
    if(mainWindow.isMaximized()){
        mainWindow.unmaximize();
    }else{
        mainWindow.maximize();
    }
});

ipcMain.on("close", (event, args) => {
    mainWindow.close();
});

ipcMain.on("drop", (event, args) => {
    loadImage(args.file);
});

ipcMain.on("fetch", (event, args) => {

    if(targetfiles.length <= 0){
        respond();
        return;
    }

    if(args == 0){
        currentIndex = 0;
    }

    if(args == 1 && targetfiles.length - 1 > currentIndex){
        currentIndex++;
    }

    if(args == -1 && currentIndex > 0){
        currentIndex--;
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

    if(targetfiles.length > 0){
        config.file = targetfiles[currentIndex];
    }

    config.theme = args.isDark ? "dark" : "light";
    config.mode = args.mouseOnly ? "mouse" : "key";
    config.flip = args.flip;

    try{
        await writeConfig();
    }catch(ex){
        return sendError(ex);
    }

});

ipcMain.on("restore", async (event, args) => {
    loadImage(config.file);
});

ipcMain.on("rotate", async (event, args) => {

    await rotate(args.angle);
    respond(targetfiles[currentIndex], args.angle);

});

ipcMain.on("chgConfigFlip", async (event, args) => {

    config.flip = args.flip;

    const angle = config.flip ? orientations.flip : orientations.none;

    if(targetfiles.length > 0){
        await rotate(angle)
        respond(targetfiles[currentIndex]);
    }else{
        respond();
    }
});
