import fs, { Dirent } from "fs";
import path from "path";
import sharp from "sharp";
import ico from "sharp-ico";
import { RotateDegree, Extensions, Jpegs } from "../constants";

sharp.cache(false);

const isDev = process.env.NODE_ENV === "development";

export default class Util {
    exists(target: string, createIfNotFound = false) {
        if (fs.existsSync(target)) {
            return true;
        }

        if (createIfNotFound) {
            fs.mkdirSync(target);
        }

        return false;
    }

    toImageFile(fullPath: string): Pic.ImageFile {
        return {
            fullPath,
            src: isDev ? `app://${fullPath}` : fullPath,
            directory: path.dirname(fullPath),
            fileName: path.basename(fullPath),
            type: "path",
            timestamp: fs.statSync(fullPath).mtimeMs,
            detail: {
                orientation: 0,
                width: 0,
                height: 0,
                renderedWidth: 0,
                renderedHeight: 0,
                format: undefined,
            },
        };
    }

    toBase64(data: Buffer) {
        return data.toString("base64");
    }

    fromBase64(data: string) {
        return Buffer.from(data, "base64");
    }

    async rotate(fullPath: string, currenOrientation: number, nextOrientation: number) {
        if (Jpegs.includes(path.extname(fullPath))) {
            return await sharp(fullPath).withMetadata({ orientation: nextOrientation }).toBuffer();
        }

        let degree = RotateDegree[currenOrientation] - RotateDegree[nextOrientation];

        if (currenOrientation === 1 || currenOrientation === 8) {
            degree = RotateDegree[nextOrientation] - RotateDegree[currenOrientation];
        }

        return await sharp(fullPath).withMetadata().rotate(degree).withMetadata().toBuffer();
    }

    async resizeBuffer(input: Pic.EditInput, size: Pic.ImageSize) {
        return await sharp(input.file, { failOnError: false }).withMetadata().resize(size).withMetadata().jpeg().toBuffer();
    }

    async clipBuffer(input: Pic.EditInput, size: Pic.ClipRectangle) {
        return await sharp(input.file).withMetadata().extract(size).withMetadata().jpeg().toBuffer();
    }

    async getMetadata(fullPath: string) {
        try {
            return await sharp(fullPath).metadata();
        } catch (ex: any) {
            if (path.extname(fullPath) == ".ico") {
                return await (ico.sharpsFromIco(fullPath)[0] as sharp.Sharp).metadata();
            }
            throw new Error(ex);
        }
    }

    async toBuffer(image: Pic.ImageFile, format: Pic.ImageFormat) {
        if (format == "png") {
            return await sharp(image.fullPath).png().toBuffer();
        } else {
            return await sharp(image.fullPath).jpeg().toBuffer();
        }
    }

    async toIcon(destPath: string, sourcePath: string, mtime?: number) {
        await ico.sharpsToIco([sharp(sourcePath)], destPath, { sizes: "default", resizeOptions: {} });
        if (mtime) {
            const modifiedDate = new Date(mtime);
            fs.utimesSync(destPath, modifiedDate, modifiedDate);
        }
    }

    async saveImage(destPath: string, data: string, mtime?: number) {
        fs.writeFileSync(destPath, data, "base64");

        if (mtime) {
            const modifiedDate = new Date(mtime);
            fs.utimesSync(destPath, modifiedDate, modifiedDate);
        }
    }

    isImageFile(dirent: Dirent) {
        if (!dirent.isFile()) return false;

        if (!Extensions.includes(path.extname(dirent.name).toLowerCase())) return false;

        return true;
    }

    private localCompareName(a: Pic.ImageFile, b: Pic.ImageFile) {
        return a.fileName.replace(path.extname(a.fileName), "").localeCompare(b.fileName.replace(path.extname(a.fileName), ""));
    }

    sort(imageFiles: Pic.ImageFile[], sortType: Pic.SortType) {
        switch (sortType) {
            case "NameAsc":
                imageFiles.sort((a, b) => this.localCompareName(a, b));
                break;
            case "NameDesc":
                imageFiles.sort((a, b) => this.localCompareName(b, a));
                break;
            case "DateAsc":
                imageFiles.sort((a, b) => a.timestamp - b.timestamp || this.localCompareName(a, b));
                break;
            case "DateDesc":
                imageFiles.sort((a, b) => b.timestamp - a.timestamp || this.localCompareName(a, b));
                break;
        }
    }
}
