import path from "path";
import type IForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
const CopyWebpackPlugin = require("copy-webpack-plugin")

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: "webpack-infrastructure",
  }),
  new CopyWebpackPlugin({
    patterns: [
        {
            from: path.join(__dirname, "src", "static",),
            to:path.resolve(__dirname, ".webpack/renderer","static")
        },
        {
          from: path.join(__dirname, "src", "static", "img"),
          to:path.resolve(__dirname, ".webpack/main", "img")
        }
    ],
}),

];
