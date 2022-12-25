import path from "path";
import { ForgeMultiHookMap, ResolvedForgeConfig } from '@electron-forge/shared-types';
import { PluginBase } from '@electron-forge/plugin-base';

interface ForgeNativeExternalsOptions {
    externals?:string[];
    includeDeps?:boolean;
}

export class ForgeNativeExternalsPlugin extends PluginBase<ForgeNativeExternalsOptions> {

    name = "ForgeNativeExternals";

    private _externals:string[];
    private _includeDeps:boolean;
    private _dir:string;
    private _isProd = false;

    constructor(options:ForgeNativeExternalsOptions) {
        super(options);

        this._externals = options.externals ?? [];
        this._includeDeps = options.includeDeps ?? true;
    }

    init = (dir: string): void => {
        this._dir = dir;
    }

    getHooks(): ForgeMultiHookMap {
        return {
            prePackage:this.prePackage,
            resolveForgeConfig:this.resolveForgeConfig
        }
    }

    prePackage = async (_forgeConfig: ResolvedForgeConfig, _platform: string, _arch: string) => {
        this._isProd = true;
    }

    getModeles = (module:string, foundModules:Set<string>) => {

        foundModules.add(module)

        const moduleRoot = path.dirname(
            require.resolve(`${module}/package.json`, { paths: [this._dir] })
        );

        const packageJson = require(path.join(moduleRoot, "package.json"))

        if(packageJson.dependencies){
            Object.keys(packageJson.dependencies).forEach((name:string) => {
                this.getModeles(name, foundModules);
            });
        }

    }

    resolveForgeConfig = async (forgeConfig: ResolvedForgeConfig): Promise<ResolvedForgeConfig> => {

        const foundModules = new Set(this._externals);

        if (this._includeDeps) {

            for (const external of this._externals) {

                this.getModeles(external, foundModules);
            }

        }

        // The webpack plugin already sets the ignore function.
        const existingIgnoreFn = forgeConfig.packagerConfig.ignore;

        if(typeof existingIgnoreFn !== "function") throw new Error("ignore not function")

        //fs.writeFileSync("a.txt", "start\n")
        // We override it and ensure we include external modules too
        forgeConfig.packagerConfig.ignore = (file:string) => {

            const existingResult = existingIgnoreFn(file);

            if (existingResult == false) {
                return false;
            }
            //fs.appendFileSync("a.txt",`${file}:${existingResult}\n`)
            if (file === "/node_modules") {
                return false;
            }

            for (const module of foundModules) {

                if (file.startsWith(`/node_modules/${module}`) || file.startsWith(`/node_modules/${module.split('/')[0]}`)) {
                    return false;
                }
            }
            //fs.appendFileSync("a.txt",`${file}:${existingResult}\n`)
            return true;
        };

        return forgeConfig;
    };
}
