const { RawSource } = require("webpack").sources;
exports.CSSPresencePlugin = class CSSPresencePlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap("CSSPresencePlugin", (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: "CSSPresencePlugin", stage: compilation.PROCESS_ASSETS_STAGE_ADDITIONS },
        () => {
          const hasCSS = Object.keys(compilation.assets).some((asset) => asset.endsWith(".css"));
          for (const chunk of compilation.chunks) for (const file of chunk.files) {
            if (!file.endsWith(".mjs")) continue;
            const asset = compilation.getAsset(file);
            const source = asset.source.source().toString();
            compilation.updateAsset(file, new RawSource(source.replace("export {", `const hasCSS = ${hasCSS}; export { hasCSS, `)));
          }
        }
      );
    });
  }
};
