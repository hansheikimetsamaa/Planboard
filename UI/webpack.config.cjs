const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const { CSSPresencePlugin } = require("./tools/css-presence.cjs");
const mod = require("./mod.json");

const userDataPath = process.env.CSII_USERDATAPATH || (process.platform === "win32" && process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "AppData", "LocalLow", "Colossal Order", "Cities Skylines II") : null);
module.exports = (env = {}, argv) => {
  const deploy = env.deploy === true || env.deploy === "true";
  if (deploy && !userDataPath) throw new Error("Cannot deploy Planboard UI: CSII user-data path is unavailable.");
  const outputPath = deploy
    ? path.resolve(userDataPath, "Mods", mod.id)
    : path.resolve(__dirname, "build");
  return ({
  mode: argv.mode || "production",
  entry: { [mod.id]: "./src/index.tsx" },
  devtool: argv.mode === "development" ? "eval-source-map" : false,
  stats: "minimal",
  externalsType: "window",
  externals: {
    react: "React",
    "react-dom": "ReactDOM",
    "cs2/modding": "cs2/modding",
    "cs2/api": "cs2/api",
    "cs2/bindings": "cs2/bindings",
    "cs2/l10n": "cs2/l10n",
    "cs2/ui": "cs2/ui",
    "cs2/input": "cs2/input",
    "cs2/utils": "cs2/utils"
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: "ts-loader", exclude: /node_modules/ },
      {
        test: /\.s?css$/,
        include: path.resolve(__dirname, "src"),
        use: [MiniCssExtractPlugin.loader, { loader: "css-loader", options: { modules: { auto: true, exportLocalsConvention: "camelCase" } } }, "sass-loader"]
      },
      { test: /\.(svg|png)$/i, type: "asset/resource", generator: { filename: "images/[name][ext]" } }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    plugins: [new TsconfigPathsPlugin()],
    alias: { "mod.json": path.resolve(__dirname, "mod.json") }
  },
  output: {
    path: outputPath,
    clean: deploy ? { keep: /^Planboard(?:[._-]|$)/ } : true,
    filename: "[name].mjs",
    library: { type: "module" },
    publicPath: "coui://ui-mods/"
  },
  experiments: { outputModule: true },
  optimization: { minimize: argv.mode !== "development", minimizer: [new TerserPlugin({ extractComments: false })] },
  plugins: [new MiniCssExtractPlugin(), new CSSPresencePlugin()]
  });
};
