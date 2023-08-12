declare global {
    interface Window {
        api: Api;
    }

    type RendererName = "Main" | "File" | "Edit";
    type Renderer = {[key in RendererName] : Electron.BrowserWindow}

    type MainChannelEventMap = {
        "minimize": Pic.Event;
        "toggle-maximize": Pic.Event;
        "close": Pic.Event;
        "drop-file": Pic.DropRequest;
        "fetch-image": Pic.FetchRequest;
        "delete": Pic.Event;
        "pin": Pic.Event;
        "restore": Pic.RestoreRequest;
        "rotate": Pic.RotateRequest;
        "remove-history": Pic.RemoveHistoryRequest;
        "toggle-fullscreen": Pic.Event;
        "set-category": Pic.CategoryChangeEvent;
        "open-file-dialog": Pic.Event;
        "clip": Pic.ClipRequest;
        "resize": Pic.ResizeRequest;
        "close-edit-dialog": Pic.Event;
        "close-file-dialog": Pic.Event;
        "open-main-context": Pic.Event;
        "restart": Pic.Event;
        "open-edit-dialog": Pic.Event;
        "save-image": Pic.SaveImageRequest;
    }

    type RendererChannelEventMap = {
        "config-loaded": Pic.Config;
        "after-fetch": Pic.FetchResult;
        "after-remove-history": Pic.RemoveHistoryResult;
        "after-pin": Pic.PinResult;
        "after-toggle-maximize": Pic.Config;
        "toggle-mode": Pic.ChangePreferenceEvent;
        "toggle-theme": Pic.ChangePreferenceEvent;
        "open-history": Pic.Event;
        "prepare-file-dialog": Pic.OpenFileDialogEvent;
        "show-actual-size": Pic.Event;
        "edit-dialog-opened": Pic.OpenEditEvent;
        "after-edit": Pic.EditResult;
        "after-save-image": Pic.SaveImageResult;
    }

    interface Api {
        send: <K extends keyof MainChannelEventMap>(channel: K, data:MainChannelEventMap[K]) => void;
        receive: <K extends keyof RendererChannelEventMap>(channel:K, listener: (data: RendererChannelEventMap[K]) => void) => () => void;
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
        type EditMode = "Clip" | "Resize"

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
            src:string;
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

        type OpenEditEvent = {
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

        type ChangePreferenceEvent = {
            preference: Preference;
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

        type CategoryChangeEvent = {
            category:number;
        }

        type OpenFileDialogEvent = {
            files:ImageFile[]
        }

        type Event = {
            args:any
        }

    }

}

export {}