import fs from "fs/promises"
import path from "path";
import { Dirent } from "fs";

const EXTENSIONS = [
    ".jpeg",
    ".jpg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".ico",
]

export default class Util{

    async exists(target:string, createIfNotFound = false){

        try{
            await fs.stat(target);

            return true;

        }catch(ex){

            if(createIfNotFound){
                await fs.mkdir(target);
            }

            return false;
        }
    }

    getImageFile(filePath:string, angle = 0){

        return {
            fullPath:filePath,
            directory:path.dirname(filePath),
            fileName:path.basename(filePath),
            angle:angle,
        }

    }

    isImageFile(dirent:Dirent){

        if(!dirent.isFile()) return false;

        if(!EXTENSIONS.includes(path.extname(dirent.name).toLowerCase())) return false;

        return true;
    }

    sortByName(a:string, b:string){
        return a.replace(path.extname(a), "").localeCompare(b.replace(path.extname(b), ""))
    }
}
