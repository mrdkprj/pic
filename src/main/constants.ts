import path from "path"

export const STATIC = path.join(__dirname, "..", "static")

export const NOT_FOUND:Pic.ImageFile = {
    fullPath:path.join(STATIC, "img", "notfound.svg"),
    directory:"",
    fileName:"",
    angle:0
}

export const ORIENTATIONS = {none:1, flip:3};

export const EXTENSIONS = [
    ".jpeg",
    ".jpg",
    ".png",
    ".gif",
    ".svg"
]

export const CONFIG_FILE_NAME = "picviewer.config.json"
export const DEFAULT_CONFIG :Pic.Config = {
    directory:"",
    fullPath:"",
    mode:"key",
    theme:"light",
    history:{},
    bounds: {width:1200, height:800, x:0, y:0},
    isMaximized: false
}
