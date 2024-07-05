import {build} from "electron-builder"

build({
    config: {
        appId: "PicViewer",
        productName: "PicViewer",
        //npmRebuild:false, // required for linux build
        win:{
            target: {
                target: "nsis",
                arch: [
                    "x64",
                ]
            },
            icon: "/src/assets/icon.ico",
            fileAssociations: [
                {
                  ext: ["ico", "gif", "png", "jpg", "jpeg", "webp", "svg"],
                },
            ]
        },
        linux:{
            target: "deb",
            category: "Graphics",
            icon: "./src/assets/icon.icns",
            fileAssociations: [
                {
                  ext: ["ico", "gif", "png", "jpg", "jpeg", "webp", "svg"],
                },
            ],
        },
        nsis: {
            oneClick: true,
            deleteAppDataOnUninstall:true,
            runAfterFinish: false,
        }
    },
});