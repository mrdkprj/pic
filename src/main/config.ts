import fs from "fs"
import path from "path";
import Util from "./util";

const CONFIG_FILE_NAME = "picviewer.config.json"
const DEFAULT_CONFIG :Pic.Config = {
    directory:"",
    fullPath:"",
    preference: {
        mode:"Keyboard",
        theme:"Dark",
        orientation:"Normal",
    },
    history:{},
    bounds: {width:1200, height:800, x:0, y:0},
    isMaximized: false
}

export default class Config{

    data:Pic.Config;

    private _file:string;
    private _directory:string;
    private _util = new Util();

    constructor(workingDirectory:string){
        this.data = DEFAULT_CONFIG;
        this._directory = process.env.NODE_ENV === "development" ? path.join(__dirname, "..", "..", "temp") : path.join(workingDirectory, "temp");
        this._file = path.join(this._directory, CONFIG_FILE_NAME)
    }

    init(){

        this._util.exists(this._directory, true);

        const fileExists = this._util.exists(this._file, false);

        if(fileExists){

            const rawData = fs.readFileSync(this._file, {encoding:"utf8"});
            this.data = this.createConfig(JSON.parse(rawData))

        }else{

            this.save()

        }
    }

    private createConfig(rawConfig:any):Pic.Config{

        Object.keys(rawConfig).forEach(key => {
            if(!(key as keyof Pic.Config in DEFAULT_CONFIG)){
                delete rawConfig[key]
            }
        })

        Object.keys(DEFAULT_CONFIG).forEach(key => {
            if(!(key in rawConfig)){
                rawConfig[key] = DEFAULT_CONFIG[key as keyof Pic.Config];
            }
        })

        return rawConfig;
    }

    save(){
        fs.writeFileSync(this._file, JSON.stringify(this.data));
    }

}


