import { IpcMainEvent } from "electron";

declare global {
    interface Window {
        api: Api;
    }

    type MainChannel = "minimize" | "toggle-maximize" | "close" | "drop-file" | "fetch-image" | "delete" | "pin" | "restore" |
                        "rotate" | "remove-history" | "toggle-fullscreen" | "set-category" | "open-file-dialog" | "clip" |
                        "resize" | "close-edit-dialog" | "close-file-dialog" | "open-main-context" | "restart" | "open-edit-dialog" |
                        "save-image";
    type MainRendererChannel = "config-loaded" | "after-fetch" | "after-remove-history" | "after-pin" | "after-toggle-maximize" |
                            "toggle-mode" | "toggle-theme" | "toggle-orientaion" | "open-history" | "toggle-clipmode" |
                            "prepare-file-dialog" | "show-actual-size";
    type FileRendererChannel = "";
    type EditRendererChannel = "edit-dialog-opened" | "after-edit" | "after-save-image" | "after-toggle-maximize";
    type RendererChannel = MainRendererChannel | FileRendererChannel | EditRendererChannel;
    type RendererName = "Main" | "File" | "Edit";
    type Renderer = {[key in RendererName] : Electron.BrowserWindow}

    type handler<T extends Pic.Args> = (event: IpcMainEvent, data:T) => (void | Promise<void>)

    interface IpcMainHandler {
        channel: MainChannel;
        handle: handler;
    }

    interface Api {
        send: <T extends Pic.Args>(channel: MainChannel, data?:T) => void;
        receive: <T extends Pic.Args>(channel:RendererChannel, listener: (data?: T) => void) => () => void;
    }

    const MAIN_WINDOW_WEBPACK_ENTRY: string;
    const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const FILE_WINDOW_WEBPACK_ENTRY: string;
    const FILE_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const EDIT_WINDOW_WEBPACK_ENTRY:string;
    const EDIT_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

    namespace Pic {

        type Timestamp = "Normal" | "Unchanged"
        type Mode = "Keyboard" | "Mouse";
        type Orientaion = "Normal" | "Flip"
        type Theme = "Dark" | "Light";
        type SortType = "NameAsc" | "NameDesc" | "DateAsc" | "DateDesc"
        type Options = Mode | Orientaion | Theme | SortType | Mtime
        type ImageTransformEvent = "transformchange" | "dragstart" | "dragend"
        type ImageSroucetype = "path" | "buffer" | "undefined"

        type Bounds = {
            width:number;
            height:number;
            x:number;
            y:number;
        }

        type Preference = {
            timestamp: Timestamp;
            sort:SortType;
            mode:Mode;
            theme:Theme;
            orientation:Orientaion;
        }

        type Config = {
            directory:string;
            fullPath:string;
            preference: Preference;
            history:{[key: string]: string};
            bounds: Bounds;
            isMaximized:boolean;
        }

        type ImageFile = {
            fullPath:string;
            directory:string;
            fileName:string;
            type:ImageSroucetype;
            timestamp:number;
            detail:ImageDetail;
        }

        type ImageDetail = {
            width:number;
            height:number;
            renderedWidth:number;
            renderedHeight:number;
            orientation:number;
            category?:number;
        }

        type OpenEditArg = {
            file:ImageFile;
            config:Config;
        }

        type FetchRequest = {
            index: number;
        }

        type FetchResult = {
            image:ImageFile;
            currentIndex:number;
            fileCount:number;
            pinned:boolean;
        }

        type RestoreRequest = {
            fullPath:string;
        }

        type PinResult = {
            success:boolean;
            history:{[key: string]: string};
        }

        type RotateRequest = {
            orientation:number;
        }

        type DropRequest = {
            fullPath:string;
        }

        type RemoveHistoryRequest = {
            fullPath:string;
        }

        type RemoveHistoryResult = {
            history:{[key: string]: string};
        }

        type ChangePreferenceArgs = {
            preference: Preference;
        }

        type EditMode = "Clip" | "Resize"

        type ImageRectangle = {
            left:number;
            right:number;
            top:number;
            bottom:number;
            width:number;
            height:number;
        }

        type ClipRectangle = {
            left:number;
            top:number;
            width:number;
            height:number;
        }

        type ImageSize = {
            width:number;
            height:number;
        }

        type ClipRequest = {
            image:ImageFile;
            rect:ClipRectangle;
        }

        type ResizeRequest = {
            image:ImageFile;
            size:ImageSize;
        }

        type EditResult = {
            image:ImageFile;
            message?:string;
        }

        type SaveImageRequest = {
            image:ImageFile;
            saveCopy:boolean;
        }

        type SaveImageResult = {
            image:ImageFile;
            message?:string;
        }

        type CategoryArgs = {
            category:number;
        }

        type OpenFileDialogArgs = {
            files:ImageFile[]
        }

        type Request = {
            renderer:RendererName
        }

        type Args = FetchRequest | FetchResult | PinResult | ChangePreferenceArgs | EditResult |
                    RotateRequest | DropRequest | RemoveHistoryRequest | RemoveHistoryResult | OpenEditArg |
                    ClipRequest | ResizeRequest | SaveImageRequest | SaveImageResult | CategoryArgs | OpenFileDialogArgs |
                    Config | Request

    }

}
