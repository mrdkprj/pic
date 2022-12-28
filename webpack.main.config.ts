import type { Configuration } from "webpack";
import { rules } from "./webpack.rules";

export const mainConfig: Configuration = {
  entry: "./src/main/index.ts",
  module: {
    rules,
  },
  externals: {"sharp": "commonjs sharp"},
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json"],
  },
};
