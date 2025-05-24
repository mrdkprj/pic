import fs from "fs";
import path from "path";
import Util from "./util";

const SETTINGS_FILE_NAME = "picviewer.config.json";
const DEFAULT_SETTINGS: Pic.Settings = {
    directory: "",
    fullPath: "",
    preference: {
        timestamp: "Unchanged",
        sort: "NameAsc",
        mode: "Keyboard",
        theme: "dark",
    },
    history: {},
    bounds: { width: 1200, height: 800, x: 0, y: 0 },
    theme: "dark",
    isMaximized: false,
};

export default class Settings {
    data: Pic.Settings = DEFAULT_SETTINGS;

    private file: string;
    private util = new Util();
    private timestamp = 0;

    constructor(workingDirectory: string) {
        const directory = process.env.NODE_ENV === "development" ? path.join(__dirname, "..", "..", "temp") : path.join(workingDirectory, "temp");
        this.util.exists(directory, true);
        this.file = path.join(directory, SETTINGS_FILE_NAME);
        this.init();
    }

    private init() {
        const fileExists = this.util.exists(this.file, false);

        if (fileExists) {
            this.timestamp = fs.statSync(this.file).mtimeMs;
            const rawData = fs.readFileSync(this.file, { encoding: "utf8" });
            this.data = this.createConfig(JSON.parse(rawData));
        } else {
            this.save();
            this.timestamp = fs.statSync(this.file).mtimeMs;
        }
    }

    private createConfig(rawSettings: any): Pic.Settings {
        const Settings = { ...DEFAULT_SETTINGS } as any;

        Object.keys(rawSettings).forEach((key) => {
            if (!(key in Settings)) return;

            const value = rawSettings[key];

            if (typeof value === "object" && key !== "history") {
                Object.keys(value).forEach((valueKey) => {
                    if (valueKey in Settings[key]) {
                        Settings[key][valueKey] = value[valueKey];
                    }
                });
            } else {
                Settings[key] = value;
            }
        });

        return Settings;
    }

    save() {
        const newTimestamp = fs.statSync(this.file).mtimeMs;
        if (newTimestamp > this.timestamp) {
            const settings = JSON.parse(fs.readFileSync(this.file, { encoding: "utf8" })) as Pic.Settings;
            this.data.history = { ...this.data.history, ...settings.history };
        }
        fs.writeFileSync(this.file, JSON.stringify(this.data));
    }
}
