const {
    app,
    BrowserWindow,
    ipcMain,
    dialog
} = require("electron");
const path = require("path");
const trash = require('trash');
const sharp = require('sharp');
const fs = require("fs").promises;
const proc = require('child_process');

sharp.cache(false);

let mainWindow;

app.on('ready', async () => {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, "preload.js")
        }
    })

    mainWindow.loadURL('file://' + __dirname + '/index.html');

    let currentIndex = 0;

    const targetfiles = [];

    const directLaunch = process.argv.length > 1 && process.argv[1] != "main.js";;

    const dir = path.join(app.getPath("userData"), "temp");

    let config;

    init();

    mainWindow.maximize();

    mainWindow.on('closed', function() {
        mainWindow = null;
    });

    async function init(){

        try{
            await fs.stat(dir);
        }catch(ex){
            await fs.mkdir(dir);
        }

        const savedPathFile = path.join(dir,"config.json");

        try{
            await fs.stat(savedPathFile);

            config = await fs.readFile(savedPathFile, {encoding:"utf8"});

        }catch(ex){
            config =  {directory:null,file:null, mode:"key", angle:1}
        }

        currentIndex = 0;

        targetfiles.length = 0;
    }

    async function loadImage(fullPath){

        const targetFile = path.basename(fullPath);
        config.directory = path.dirname(fullPath);
        config.file = fullPath;

        targetfiles.length = 0;

        const files = await fs.readdir(config.directory);

        files.sort(sortByName).forEach((file, index) => {
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
        }

        const data = {
            name: path.basename(filePath),
            path:filePath,
            counter: (currentIndex + 1) + " / " + targetfiles.length,
            mode:config.mode,
            angle:orientation
        }

        mainWindow.webContents.send("afterfetch", data);

    }

    function sendError(ex){
        mainWindow.webContents.send("onError", ex.message);
    }

    async function writeConfig(){
        try{
            await fs.writeFile(path.join(dir,"config.json"), JSON.stringify(config));
        }catch(ex){
            sendError(ex);
        }
    }

    ipcMain.on("domready", (event, args) => {
        if(directLaunch && targetfiles.length == 0){
            loadImage(process.argv[1]);
        }else if(targetfiles.length > 0){
            respond(targetfiles[currentIndex]);
        }else{
            respond();
        }
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

        proc.exec('explorer /e,/select,"' + targetfiles[currentIndex] + '"');

    });

    ipcMain.on("open", async (event, args) => {

        const result = await dialog.showOpenDialog(null, {
            properties: ["openFile"],
            title: "Select image",
            defaultPath: config.directory ? config.directory :'.',
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

        if(targetfiles.length <= 0){
            return;
        }

        try{
            config.file = targetfiles[currentIndex];
            await writeConfig();
        }catch(ex){
            return sendError(ex);
        }

    });

    ipcMain.on("restore", async (event, args) => {

        const body = await fs.readFile(path.join(dir,"config.json"), {encoding:"utf8"});
        config = JSON.parse(body);

        loadImage(config.file);
    });

    ipcMain.on("rotate", async (event, args) => {

        try{
            const buffer = await sharp(targetfiles[currentIndex])
                                .withMetadata({orientation: args.angle})
                                .toBuffer();

            await sharp(buffer).withMetadata().toFile(targetfiles[currentIndex]);

            respond(targetfiles[currentIndex], args.angle);

        }catch(ex){
            sendError(ex);
        }
    });

    ipcMain.on("chgmode", (event, args) => {
        config.mode = args.mouseOnly == true ? "mouse" : "key";
    });

});