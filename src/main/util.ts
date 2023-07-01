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
            detail:{
                orientation:0,
                width:0,
                height:0,
            }
        }

    }

    async getOrientation(fullPath:string){
        return (await this.getMetadata(fullPath)).orientation
    }

    async rotate(fullPath:string, orientation:number){

        const buffer = await sharp(fullPath).withMetadata({orientation}).toBuffer();

        await sharp(buffer).withMetadata().toFile(fullPath);

    }

    async resize(fullPath:string, size:{width:number, height:number}, destPath:string){
        await sharp(fullPath).resize(size).toFile(destPath)
    }

    async resizeBuffer(fullPath:string | Buffer, size:Pic.ImageSize){
        return await sharp(fullPath).resize(size).jpeg().toBuffer();
    }

    async clipBuffer(fullPath:string | Buffer, size:Pic.ImageRectangle){
        return await sharp(fullPath).extract(size).jpeg().toBuffer();
    }

    async getMetadata(fullPath:string){
        return await sharp(fullPath).metadata();
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
