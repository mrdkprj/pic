import type { FormatEnum } from "sharp";

declare global {
    interface Window {
        api: Api;
    }

    type RendererName = "Main" | "Edit";
    type Renderer = { [key in RendererName]: Electron.BrowserWindow | undefined };

    type MainChannelEventMap = {
        minimize: Pic.Event;
        "toggle-maximize": Pic.Event;
        close: Pic.Event;
        "drop-file": Pic.DropRequest;
        "fetch-image": Pic.FetchRequest;
        delete: Pic.Event;
        pin: Pic.Event;
        restore: Pic.RestoreRequest;
        rotate: Pic.RotateRequest;
        "remove-history": Pic.RemoveHistoryRequest;
        "toggle-fullscreen": Pic.FullscreenChangeEvent;
        clip: Pic.ClipRequest;
        resize: Pic.ResizeRequest;
        "close-edit-dialog": Pic.Event;
        "menu-click": Pic.ContextMenuClickEvent;
        restart: Pic.Event;
        "open-edit-dialog": Pic.Event;
        "save-image": Pic.SaveImageRequest;
        menu: Pic.Position;
        error: Pic.ShowDialogRequest;
    };

    type RendererChannelEventMap = {
        ready: Pic.ReadyEvent;
        "after-fetch": Pic.FetchResult;
        "after-remove-history": Pic.RemoveHistoryResult;
        "after-pin": Pic.PinResult;
        "after-toggle-maximize": Pic.Config;
        "toggle-mode": Pic.ChangePreferenceEvent;
        "open-history": Pic.Event;
        "prepare-file-dialog": Pic.OpenFileDialogEvent;
        "show-actual-size": Pic.Event;
        "edit-dialog-opened": Pic.OpenEditEvent;
        "after-edit": Pic.EditResult;
        "after-save-image": Pic.SaveImageResult;
        "after-confirm": Pic.ConfirmResult;
    };

    interface Api {
        send: <K extends keyof MainChannelEventMap>(channel: K, data: MainChannelEventMap[K]) => void;
        receive: <K extends keyof RendererChannelEventMap>(channel: K, listener: (data: RendererChannelEventMap[K]) => void) => () => void;
        removeAllListeners: <K extends keyof RendererChannelEventMap>(channel: K) => void;
        onFileDrop: (files: File[]) => string[];
    }

    namespace Pic {
        type Timestamp = "Normal" | "Unchanged";
        type Mode = "Keyboard" | "Mouse";
        type Theme = "dark" | "light";
        type SortType = "NameAsc" | "NameDesc" | "DateAsc" | "DateDesc";

        type ContextMenuSubTypeMap = {
            OpenFile: null;
            Reveal: null;
            Reload: null;
            Mode: Mode;
            Orientation: null;
            Theme: Pic.Theme;
            History: null;
            ToFirst: null;
            ToLast: null;
            Timestamp: Timestamp;
            Sort: SortType;
            ShowActualSize: null;
        };

        type ContextMenuCallback<K extends keyof ContextMenuSubTypeMap> = (menu: K, args?: Mp.ContextMenuSubTypeMap[K]) => void;

        type ImageTransformEvent = "transformchange" | "dragstart" | "dragend";
        type ImageSroucetype = "path" | "buffer" | "undefined";
        type EditMode = "Clip" | "Resize";

        type Bounds = {
            width: number;
            height: number;
            x: number;
            y: number;
        };

        type Position = {
            x: number;
            y: number;
        };

        type Preference = {
            timestamp: Timestamp;
            sort: SortType;
            mode: Mode;
            theme: Theme;
        };

        type ImageRectangle = {
            left: number;
            right: number;
            top: number;
            bottom: number;
            width: number;
            height: number;
        };

        type ClipRectangle = {
            left: number;
            top: number;
            width: number;
            height: number;
        };

        type ImageSize = {
            width: number;
            height: number;
        };

        type ReadyEvent = {
            settings: Pic.Settings;
        };

        type Settings = {
            directory: string;
            fullPath: string;
            preference: Preference;
            history: { [key: string]: string };
            bounds: Bounds;
            isMaximized: boolean;
            theme: Pic.Theme;
        };

        type ImageFile = {
            fullPath: string;
            src: string;
            directory: string;
            fileName: string;
            type: ImageSroucetype;
            timestamp: number;
            detail: ImageDetail;
        };

        type ImageFormat = keyof FormatEnum | undefined | "ico";
        type ImageDetail = {
            width: number;
            height: number;
            renderedWidth: number;
            renderedHeight: number;
            orientation: number;
            format: Pic.ImageFormat;
            category?: number | undefined;
        };

        type OpenEditEvent = {
            file: ImageFile;
            config: Config;
        };

        type FetchRequest = {
            index: number;
        };

        type FetchResult = {
            image: ImageFile;
            currentIndex: number;
            fileCount: number;
            pinned: boolean;
        };

        type FullscreenChangeEvent = {
            fullscreen: boolean;
        };

        type RestoreRequest = {
            fullPath: string;
        };

        type PinResult = {
            success: boolean;
            history: { [key: string]: string };
        };

        type RotateRequest = {
            orientation: number;
        };

        type DropRequest = {
            fullPath: string;
        };

        type RemoveHistoryRequest = {
            fullPath: string;
        };

        type RemoveHistoryResult = {
            history: { [key: string]: string };
        };

        type ChangePreferenceEvent = {
            preference: Preference;
        };

        type ClipRequest = {
            image: ImageFile;
            rect: ClipRectangle;
        };

        type ResizeRequest = {
            image: ImageFile;
            size: ImageSize;
            format?: Pic.ImageFormat;
        };

        type EditInput = {
            file: string | Buffer;
            format: Pic.ImageFormat;
        };

        type EditOutput = {
            file: Buffer;
            format: Pic.ImageFormat;
        };

        type EditResult = {
            image: ImageFile;
            message?: string;
        };

        type SaveImageRequest = {
            image: ImageFile;
            saveCopy: boolean;
        };

        type SaveImageResult = {
            image: ImageFile;
            status: "Done" | "Cancel" | "Error";
            message?: string;
        };

        type ShowDialogRequest = {
            renderer: RendererName;
            message: string;
        };

        type Event = {
            args?: any;
        };
    }
}

export {};
