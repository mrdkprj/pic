import { IpcMainEvent } from "electron";

declare global {
    interface Window {
        api: Api;
    }

    type MainChannel = "minimize" | "toggle-maximize" | "close" | "drop-file" | "fetch-image" | "delete" |
                        "reveal" | "save" | "restore" | "open" | "rotate" | "change-flip" | "remove-history" |
                        "toggle-fullscreen" | "set-category" | "open-file-dialog" | "close-file-dialog";
    type RendererChannel = "config-loaded" | "after-fetch" | "after-remove-history" | "after-save" | "after-toggle-maximize" |
                            "prepare-file-dialog" | "error";

    interface IpcMainHandler {
        channel: MainChannel;
        handle: handler;
    }

    type handler<T extends Pic.Args> = (event: IpcMainEvent, data:T) => (void | Promise<void>)

    interface Api {
        send: <T extends Pic.Args>(channel: MainChannel, data?:T) => void;
        receive: <T extends Pic.Args>(channel:RendererChannel, listener: (data?: T) => void) => () => void;
    }

    const MAIN_WINDOW_WEBPACK_ENTRY: string;
    const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
    const FILE_WINDOW_WEBPACK_ENTRY: string;
    const FILE_WINDOW_PRELOAD_WEBPACK_ENTRY: string;


    namespace Pic {

        type Bounds = {
            width:number;
            height:number;
            x:number;
            y:number;
        }

        type Mode = "key" | "mouse";
        type Theme = "dark" | "light";

        type Config = {
            directory:string;
            fullPath:string;
            mode: Mode;
            theme:Theme;
            history:{[key: string]: string};
            bounds: Bounds;
            isMaximized:boolean;
        }

        type ImageFile = {
            fullPath:string;
            directory:string;
            fileName:string;
            angle:number;
            static?:boolean;
            category?:number;
        }

        type FetchRequest = {
            index: number;
        }

        type FetchResult = {
            image:ImageFile;
            counter:string;
            saved:boolean;
        }

        type RestoreRequest = {
            fullPath:string;
            directory:string;
        }

        type SaveRequest = {
            isDark:boolean;
            mouseOnly:boolean;
            flip:boolean;
            history:{[key: string]: string};
        }

        type SaveResult = {
            success:boolean;
            history:{[key: string]: string};
        }

        type RotateRequest = {
            orientation:number;
        }

        type DropRequest = {
            fullPath:string;
        }

        type FlipRequest = {
            flip:boolean;
        }

        type RemoveHistoryRequest = {
            fullPath:string;
        }

        type RemoveHistoryResult = {
            history:{[key: string]: string};
        }

        type CategoryArgs = {
            category:number;
        }

        type OpenFileDialogArgs = {
            files:ImageFile[]
        }

        type ErrorArgs = {
            message:string;
        }

        type Request = {
            data:string;
        }

        type Args = FetchRequest | FetchResult | RestoreRequest | SaveRequest | SaveResult |
                    RotateRequest | DropRequest | FlipRequest | RemoveHistoryRequest | RemoveHistoryResult |
                    CategoryArgs | OpenFileDialogArgs | Config | ErrorArgs | Request

    }

}
