import { writable } from "svelte/store";
import { EmptyImageFile } from "../../constants";

const IMAGE_AREA_MARGIN = 15;
const TITLEBAR_HEIGHT = 35;

type ClipPosition = {
    startX: number;
    startY: number;
};

type AppState = {
    currentImageFile: Pic.ImageFile;
    imageSrc: string;
    title: string;
    clipCanvasStyle: string;
    clipPosition: ClipPosition;
    clipAreaStyle: string;
    editMode: Pic.EditMode;
    isMaximized: boolean;
    loading: boolean;
    dragging: boolean;
    canUndo: boolean;
    canRedo: boolean;
    isResized: boolean;
    isEdited: boolean;
    clipping: boolean;
    allowShrink: boolean;
    scaleText: string;
};

type AppAction =
    | { type: "loadImage"; value: Pic.ImageFile }
    | { type: "clearImage" }
    | { type: "title"; value: number }
    | { type: "startClip"; value: { rect: DOMRect; position: ClipPosition } }
    | { type: "moveClip"; value: { x: number; y: number } }
    | { type: "editMode"; value: Pic.EditMode }
    | { type: "isMaximized"; value: boolean }
    | { type: "loading"; value: boolean }
    | { type: "dragging"; value: boolean }
    | { type: "buttonState"; value: { canUndo: boolean; canRedo: boolean; isResized: boolean } }
    | { type: "clipping"; value: boolean }
    | { type: "allowShrink"; value: boolean }
    | { type: "imageScale"; value: number };

export const initialAppState: AppState = {
    currentImageFile: EmptyImageFile,
    imageSrc: "",
    title: "",
    clipCanvasStyle: "",
    clipPosition: {
        startX: 0,
        startY: 0,
    },
    clipAreaStyle: "",
    editMode: "Resize",
    isMaximized: false,
    loading: false,
    dragging: false,
    canUndo: false,
    canRedo: false,
    isResized: false,
    isEdited: false,
    clipping: false,
    allowShrink: false,
    scaleText: "",
};

const updater = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case "title": {
            const size = {
                width: Math.floor(state.currentImageFile.detail.renderedWidth * action.value),
                height: Math.floor(state.currentImageFile.detail.renderedHeight * action.value),
            };
            const title = `${state.currentImageFile.fileName} (${size.width} x ${size.height})`;
            return { ...state, title };
        }

        case "loadImage": {
            const isEdited = action.value.type === "buffer";
            const imageSrc = action.value.type === "path" ? `app://${action.value.fullPath}?${new Date().getTime()}` : `data:image/jpeg;base64,${action.value.fullPath}`;
            return { ...state, imageSrc, currentImageFile: action.value, isEdited };
        }

        case "clearImage":
            return { ...state, imageSrc: "" };

        case "startClip": {
            const { width, height, top, left } = action.value.rect;
            const rectTop = top - (TITLEBAR_HEIGHT + IMAGE_AREA_MARGIN);
            const rectLeft = left - IMAGE_AREA_MARGIN;
            return {
                ...state,
                clipping: true,
                clipCanvasStyle: `width: ${width}px; height:${height}px; top:${rectTop}px; left:${rectLeft}px;`,
                clipPosition: { startY: action.value.position.startY, startX: action.value.position.startX },
                clipAreaStyle: `width:0px; height:0px; top:${action.value.position.startY}px; left:${action.value.position.startX}`,
            };
        }

        case "moveClip": {
            const moveX = action.value.x - state.clipPosition.startX;
            const moveY = action.value.y - state.clipPosition.startY;
            const scaleX = moveX >= 0 ? 1 : -1;
            const scaleY = moveY >= 0 ? 1 : -1;
            const width = Math.abs(moveX);
            const height = Math.abs(moveY);
            return { ...state, clipAreaStyle: `transform:scale(${scaleX}, ${scaleY}); width:${width}px; height:${height}px; top:${state.clipPosition.startY}px; left:${state.clipPosition.startX}px` };
        }

        case "editMode":
            return { ...state, editMode: action.value };

        case "isMaximized":
            return { ...state, isMaximized: action.value };

        case "loading":
            return { ...state, loading: action.value };

        case "dragging":
            return { ...state, dragging: action.value };

        case "buttonState":
            return { ...state, canUndo: action.value.canUndo, canRedo: action.value.canRedo, isResized: action.value.isResized };

        case "clipping":
            return { ...state, clipping: action.value };

        case "allowShrink":
            return { ...state, allowShrink: action.value };

        case "imageScale":
            return { ...state, scaleText: `${Math.floor(action.value * 100)}%` };

        default:
            return state;
    }
};

export const reducer = (state: AppState) => {
    const store = writable(state);

    const dispatch = (action: AppAction) => {
        store.update((state) => updater(state, action));
    };

    return { appState: store, dispatch };
};
