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
            icon: "/src/static/img/icon.ico",
            fileAssociations: [
                {
                  ext: ["ico", "gif", "png", "jpg", "jpeg", "webp", "svg"],
                  description: "Image files",
                },
            ]
        },
        linux:{
            target: "deb",
            category: "Graphics",
            icon: "./src/static/img/icon.icns",
            fileAssociations: [
                {
                  ext: ["ico", "gif", "png", "jpg", "jpeg", "webp", "svg"],
                  description: "Image files",
                },
            ],
        },
        nsis: {
            oneClick: true,
            allowToChangeInstallationDirectory: false,
            runAfterFinish: false,
        }
    },
});