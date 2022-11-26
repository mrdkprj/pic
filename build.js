const builder = require("electron-builder");

builder.build({
    config: {
        "appId": "PicViewer",
        "productName": "PicViewer",
        "win":{
            "target": {
                "target": "nsis",
                "arch": [
                    "x64",
                ]
            },
            "icon": "./resources/icon.ico",
            "fileAssociations": [
                {
                  "ext": ["ico", "gif", "png", "jpg", "jpeg"],
                  "description": "Image files",
                },
            ]
        },
        "nsis": {
            "oneClick": true,
            "allowToChangeInstallationDirectory": false,
            "runAfterFinish": false,
        }
    }
});