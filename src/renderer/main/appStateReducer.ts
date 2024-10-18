import { writable } from "svelte/store";
import { EmptyImageFile } from "../../constants";

type AppState = {
    currentImageFile: Pic.ImageFile;
    imageSrc: string;
    history: { [key: string]: string };
    isMaximized: boolean;
    isFullscreen: boolean;
    isPinned: boolean;
    isMouseOnly: boolean;
    isHistoryOpen: boolean;
    locked: boolean;
    dragging: boolean;
    counter: string;
    fileCount: number;
    title: string;
    scaleRate: string;
    category: string;
};

type AppAction =
    | { type: "loadImage"; value: Pic.FetchResult }
    | { type: "history"; value: { [key: string]: string } }
    | { type: "isMaximized"; value: boolean }
    | { type: "isFullscreen"; value: boolean }
    | { type: "isPinned"; value: boolean }
    | { type: "isMouseOnly"; value: boolean }
    | { type: "category"; value: string }
    | { type: "locked"; value: boolean }
    | { type: "dragging"; value: boolean }
    | { type: "title"; value: string }
    | { type: "scaleRate"; value: string }
    | { type: "isHistoryOpen"; value: boolean };

export const initialAppState: AppState = {
    currentImageFile: EmptyImageFile,
    imageSrc: "",
    history: {},
    isMaximized: false,
    isPinned: false,
    isMouseOnly: false,
    isFullscreen: false,
    locked: false,
    dragging: false,
    isHistoryOpen: false,
    counter: "",
    fileCount: 0,
    title: "",
    scaleRate: "",
    category: "",
};

const updater = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case "isMaximized":
            return { ...state, isMaximized: action.value };

        case "isPinned":
            return { ...state, isPinned: action.value };

        case "isMouseOnly":
            return { ...state, isMouseOnly: action.value };

        case "loadImage": {
            const counter = `${action.value.currentIndex} / ${action.value.fileCount}`;
            const imageSrc = action.value.image.type === "path" ? `${action.value.image.src}?${new Date().getTime()}` : "";
            return { ...state, imageSrc, currentImageFile: action.value.image, isPinned: action.value.pinned, fileCount: action.value.fileCount, counter };
        }

        case "history":
            return { ...state, history: action.value };

        case "isFullscreen":
            return { ...state, isFullscreen: action.value };

        case "category":
            return { ...state, category: action.value };

        case "locked":
            return { ...state, locked: action.value };

        case "dragging":
            return { ...state, dragging: action.value };

        case "title":
            return { ...state, title: action.value };

        case "scaleRate":
            return { ...state, scaleRate: action.value };

        case "isHistoryOpen":
            return { ...state, isHistoryOpen: action.value };

        default:
            return state;
    }
};

const store = writable(initialAppState);

export const dispatch = (action: AppAction) => {
    store.update((state) => updater(state, action));
};

export const appState = store;
