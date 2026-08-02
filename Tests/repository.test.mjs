import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("local UI builds and game deployment have separate outputs", async () => {
  const packageJson = JSON.parse(await read("../UI/package.json"));
  const webpack = await read("../UI/webpack.config.cjs");
  const project = await read("../Code/Planboard.csproj");

  assert.doesNotMatch(packageJson.scripts.build, /deploy=true/);
  assert.match(packageJson.scripts.deploy, /deploy=true/);
  assert.match(webpack, /env\.deploy/);
  assert.match(webpack, /path\.resolve\(__dirname, "build"\)/);
  assert.match(project, /npm run deploy/);
});

test("strict UI cleanup checks remain enabled", async () => {
  const config = JSON.parse(await read("../UI/tsconfig.json"));
  assert.equal(config.compilerOptions.noUnusedLocals, true);
  assert.equal(config.compilerOptions.noUnusedParameters, true);
});

test("public release identity and metadata stay Planboard-only", async () => {
  const project = await read("../Code/Planboard.csproj");
  const settings = await read("../Code/Settings.cs");
  const mod = await read("../Code/Mod.cs");
  const contracts = await read("../UI/src/types/contracts.ts");
  const labels = await read("../UI/src/labels.ts");
  const publish = await read("../Code/Properties/PublishConfiguration.xml");
  const ignore = await read("../.gitignore");

  const forbidden = ["City", "Tasks"].join("");
  const forbiddenLower = forbidden.toLowerCase();
  for (const source of [project, settings, mod, contracts, labels]) {
    assert.equal(source.includes(forbidden), false);
    assert.equal(source.includes(forbiddenLower), false);
  }

  assert.match(project, /<RootNamespace>Planboard<\/RootNamespace>/);
  assert.match(mod, /const string Id = "planboard"/);
  assert.match(contracts, /group: "planboard"/);
  assert.match(labels, /`Planboard\.UI\.\$\{key\}`/);
  assert.match(publish, /<GameVersion Value="1\.6\.\*" \/>/);
  assert.match(publish, /Planboard is a location-aware planning board/);
  assert.match(publish, /0\.1\.0 - Initial public release/);
  assert.doesNotMatch(publish, /See (LongDescription|Changelog)\.md/);
  assert.match(ignore, /^Inspiration\/$/m);
  await read("../Code/LongDescription.md");
  await read("../Code/Changelog.md");
});