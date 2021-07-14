const builder = require("electron-builder");

builder.build({
    config: {
        "appId": "PicViewer",
        "win":{
            "target": {
                "target": "zip",
                "arch": [
                    "x64",
                    "ia32",
                ]
            },
            "fileAssociations": [
                {
                  // 拡張子
                  "ext": ["ico", "gif", "png", "jpg", "jpeg", "webp"],
                  // ファイルの種類
                  "description": "Image files",
                },
            ],
        }
    }
});