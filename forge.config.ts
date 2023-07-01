import type { ForgeConfig } from "@electron-forge/shared-types";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";
import fs from "fs/promises"
import path from "path"

const config: ForgeConfig = {
  plugins: [
      new WebpackPlugin({
        mainConfig,
        renderer: {
          config: rendererConfig,
          entryPoints: [
            {
              html: "./src/renderer/main.html",
              js: "./src/renderer/main.ts",
              name: "main_window",
              preload: {
                js: "./src/renderer/mainPreload.ts",
              },
            },
            {
              html: "./src/renderer/file.html",
              js: "./src/renderer/file.ts",
              name: "file_window",
              preload: {
                js: "./src/renderer/filePreload.ts",
              },
            },
            {
              html: "./src/renderer/edit.html",
              js: "./src/renderer/edit.ts",
              name: "edit_window",
              preload: {
                js: "./src/renderer/editPreload.ts",
              },
            },
          ],
        },
      }),
  ],
  hooks: {
    postPackage: async (_forgeConfig: any, packageResult: any) => {
        // remove out folder produced by Electron Forge
        await fs.rm(path.join(packageResult.outputPaths[0], ".."), {recursive:true})
    }
  }
};

export default config;
