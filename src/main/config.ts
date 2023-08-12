import fs from "fs"
import path from "path";
import Util from "./util";

const CONFIG_FILE_NAME = "picviewer.config.json"
const DEFAULT_CONFIG :Pic.Config = {
    directory:"",
    fullPath:"",
    preference: {
        timestamp:"Unchanged",
        sort:"NameAsc",
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

    private file:string;
    private util = new Util();

    constructor(workingDirectory:string){
        const directory = process.env.NODE_ENV === "development" ? path.join(__dirname, "..", "..", "temp") : path.join(workingDirectory, "temp");
        this.util.exists(directory, true);
        this.file = path.join(directory, CONFIG_FILE_NAME)
        this.init();
    }

    private init(){

        const fileExists = this.util.exists(this.file, false);

        if(fileExists){

            const rawData = fs.readFileSync(this.file, {encoding:"utf8"});
            this.data = this.createConfig(JSON.parse(rawData))

        }else{

            this.save()

        }
    }

    private createConfig(rawConfig:any):Pic.Config{

        const config = {...DEFAULT_CONFIG} as any;

        Object.keys(rawConfig).forEach(key => {

            if(!(key in config)) return;

            const value = rawConfig[key];

            if(typeof value === "object" && key !== "history"){

                Object.keys(value).forEach(valueKey => {
                    if(valueKey in config[key]){
                        config[key][valueKey] = value[valueKey]
                    }
                })
            }else{
                config[key] = value;
            }
        })

        return config;
    }

    save(){
        fs.writeFileSync(this.file, JSON.stringify(this.data));
    }

}


