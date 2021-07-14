const {
    app,
    BrowserWindow,
    ipcMain
} = require("electron");
const path = require("path");
const trash = require('trash');
const fs = require("fs");
const { inherits } = require("util");

let mainWindow;

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
        nodeIntegration: false, // is default value after Electron v5
        contextIsolation: true, // protect against prototype pollution
        enableRemoteModule: false, // turn off remote
        preload: path.join(__dirname, "preload.js") // use a preload script
        }
    })

    // Electronに表示するhtmlを絶対パスで指定（相対パスだと動かない）
    mainWindow.loadURL('file://' + __dirname + '/index.html');

    let folder;

    let currentIndex = 0;

    let targetFile = null;

    const targetfiles = [];

    const directLaunch = process.argv.length > 1 && process.argv[1] != "main.js";;

    init();

    mainWindow.maximize();

    //mainWindow.webContents.openDevTools()

    mainWindow.on('closed', function() {
        mainWindow = null;
    });

    function init(){
        folder = null;

        currentIndex = 0;

        targetFile = null;

        targetfiles.length = 0;
/*
        directLaunch = process.argv.length > 1 && process.argv[1] != "main.js";

        if(directLaunch){
            targetFile = path.basename(process.argv[1]);
            folder = path.dirname(process.argv[1]);
        }
*/
    }

    function loadImage(args){

        targetFile = args.name;
        folder = path.dirname(args.path);

        targetfiles.length = 0;
        fs.readdir(folder, (err, files) => {
            files.forEach((file, index) => {
                if(targetFile == file){
                    currentIndex = index;
                }
                targetfiles.push(folder + "\\" + file);
            })
            mainWindow.webContents.send("afterfetch", targetfiles[currentIndex]);
        });
    }

    ipcMain.on("reload", (e, data) => {
        init();
    });

    ipcMain.on("domready", (event, args) => {
        if(directLaunch){
            loadImage({name:path.basename(process.argv[1]), path:rocess.argv[1]});
        }else{
            mainWindow.webContents.send("afterfetch", null);
        }
    });

    ipcMain.on("start", (event, args) => {
        loadImage(args);
    });


    ipcMain.on("fetch", (event, args) => {

        if(targetfiles.length <= 0){
            mainWindow.webContents.send("afterfetch", null);
            return;
        }

        if(args == 0){
            currentIndex = 0;
        }

        if(args == 1 && targetfiles.length > currentIndex){
            currentIndex++;
        }

        if(args == -1 && currentIndex > 0){
            currentIndex--;
        }

        mainWindow.webContents.send("afterfetch", targetfiles[currentIndex]);
    });

    ipcMain.on("delete", async (event, args) => {

        if(targetfiles.length <= 0){
            mainWindow.webContents.send("afterfetch", null);
            return;
        }

        try{
            const result = await trash(targetfiles[currentIndex]);

            targetfiles.splice(currentIndex, 1);

            if(currentIndex > 0){
                currentIndex--;
            }

            if(targetfiles.length < currentIndex){
                currentIndex--;
            }

            mainWindow.webContents.send("afterfetch", targetfiles[currentIndex]);

        }catch(ex){
            mainWindow.webContents.send("onError", ex.message);
        }
    });
});