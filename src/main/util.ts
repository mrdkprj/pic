import fs, { Dirent } from "fs"
import path from "path";
import sharp from "sharp";

sharp.cache(false);

const EXTENSIONS = [
    ".jpeg",
    ".jpg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".ico",
]

export const EmptyImageFile = {
    fullPath:"",
    directory:"",
    fileName:"",
    exists:false,
    timestamp: 0,
    detail:{
        orientation:0,
        width:0,
        height:0,
    }
}

export default class Util{

    exists(target:string, createIfNotFound = false){

        if(fs.existsSync(target)){
            return true;
        }

        if(createIfNotFound){
            fs.mkdirSync(target);
        }

        return false;

    }

    toImageFile(fullPath:string):Pic.ImageFile{

        return {
            fullPath,
            directory:path.dirname(fullPath),
            fileName:path.basename(fullPath),
            exists:true,
            timestamp: fs.statSync(fullPath).mtimeMs,
            detail:{
                orientation:0,
                width:0,
                height:0,
            }
        }

    }

    async rotate(fullPath:string, orientation:number){

        const buffer = await sharp(fullPath).withMetadata({orientation}).toBuffer();

        await sharp(buffer).withMetadata().toFile(fullPath);

    }

    async resize(fullPath:string, size:{width:number, height:number}, destPath:string){
        await sharp(fullPath).resize(size).toFile(destPath)
    }

    async resizeBuffer(fullPath:string | Buffer, size:Pic.ImageSize){
        return await sharp(fullPath).resize(size).withMetadata().jpeg().toBuffer();
    }

    async clipBuffer(fullPath:string | Buffer, size:Pic.ClipRectangle){
        return await sharp(fullPath).extract(size).withMetadata().jpeg().toBuffer();
    }

    async getMetadata(fullPath:string){
        return await sharp(fullPath).metadata();
    }

    isImageFile(dirent:Dirent){

        if(!dirent.isFile()) return false;

        if(!EXTENSIONS.includes(path.extname(dirent.name).toLowerCase())) return false;

        return true;
    }

    sort(imageFiles:Pic.ImageFile[], sortType:Pic.SortType){

        switch(sortType){
            case "NameAsc":
                imageFiles.sort((a,b) => a.fileName.replace(path.extname(a.fileName), "").localeCompare(b.fileName.replace(path.extname(b.fileName), "")))
                break;
            case "NameDesc":
                imageFiles.sort((a,b) => b.fileName.replace(path.extname(b.fileName), "").localeCompare(a.fileName.replace(path.extname(a.fileName), "")))
                break;
            case "DateAsc":
                imageFiles.sort((a,b) => a.timestamp - b.timestamp)
                break;
            case "DateDesc":
                imageFiles.sort((a,b) => b.timestamp - a.timestamp)
                break;
        }
    }

    sortByName(a:string, b:string){
        return a.replace(path.extname(a), "").localeCompare(b.replace(path.extname(b), ""))
    }
}
