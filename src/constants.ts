export enum MainContextMenuTypes {
    OpenFile,
    Reveal,
    Reload,
    Mode,
    Orientaion,
    Theme,
    History,
    ToFirst,
    ToLast,
    Timestamp,
    Sort,
    ShowActualSize,
}

export const EmptyImageFile: Pic.ImageFile = {
    fullPath: "",
    directory: "",
    fileName: "",
    type: "undefined",
    src: "",
    timestamp: 0,
    detail: {
        orientation: 0,
        width: 0,
        height: 0,
        renderedWidth: 0,
        renderedHeight: 0,
    },
};

export const BACKWARD = -1;
export const FORWARD = 1;

export const Orientations = [1, 6, 3, 8];

export const OrientationName = {
    None: 1,
    Clock90deg: 6,
    Clock180deg: 3,
    Clock270deg: 8,
};

export const RotateDegree: { [key: number]: number } = {
    1: 0,
    6: 90,
    3: 180,
    8: 270,
};

export const Extensions = [".jpeg", ".jpg", ".png", ".gif", ".svg", ".webp", ".ico"];

export const Jpegs = [".jpeg", ".jpg"];

export const Labels = {
    OpenFile: "Open File",
    Reveal: "Reveal In Explorer",
    History: "History",
    ShowActualSize: "Show Actual Size",
    MoveFirst: "Move To First",
    MoveLast: "Move To Last",
    SortBy: "Sort By",
    Timestamp: "Timestamp",
    Mode: "Mode",
    Orientation: "Orientation",
    Theme: "Theme",
    Reload: "Reload",
    NameAsc: "Name(Asc)",
    NameDesc: "Name(Desc)",
    DateAsc: "Date(Asc)",
    DateDesc: "Date(Desc)",
    TimestampNormal: "Normal",
    TimestampUnchanged: "Unchanged",
    ModeMouse: "Mouse",
    ModeKeyboard: "Keyboard",
    OrientationNormal: "Normal",
    OrientationFlip: "Flip",
    ThemeLight: "Light",
    ThemeDark: "Dark",
};
