import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Repository checks keep build, release, and public-source conventions intentional.
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// A local UI build must never replace the package currently installed in the game.
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

// Native verification depends on the licensed CS2 toolchain and therefore stays self-hosted.
test("native verification is available on a licensed self-hosted Windows runner", async () => {
  const workflow = await read("../.github/workflows/native-verify.yml");
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /self-hosted, windows, cs2-modding/);
  assert.match(workflow, /dotnet build Planboard\.sln -c Release/);
});
test("strict UI cleanup checks remain enabled", async () => {
  const config = JSON.parse(await read("../UI/tsconfig.json"));
  assert.equal(config.compilerOptions.noUnusedLocals, true);
  assert.equal(config.compilerOptions.noUnusedParameters, true);
});

// Keep public identifiers stable: saves, settings, bindings, and published metadata rely on them.
test("public release identity and metadata stay Planboard-only", async () => {
  const project = await read("../Code/Planboard.csproj");
  const settings = await read("../Code/Settings.cs");
  const mod = await read("../Code/Mod.cs");
  const contracts = await read("../UI/src/types/contracts.ts");
  const labels = await read("../UI/src/labels.ts");
  const packageJson = JSON.parse(await read("../UI/package.json"));
  const publish = await read("../Code/Properties/PublishConfiguration.xml");
  const ignore = await read("../.gitignore");
  const forbidden = ["City", "Tasks"].join("");
  const forbiddenLower = forbidden.toLowerCase();
  for (const source of [project, settings, mod, contracts, labels]) {
    assert.equal(source.includes(forbidden), false);
    assert.equal(source.includes(forbiddenLower), false);
  }
  assert.match(project, /<RootNamespace>Planboard<\/RootNamespace>/);
  assert.match(project, /<Version>0\.1\.5<\/Version>/);
  assert.match(project, /<AssemblyVersion>0\.1\.5\.0<\/AssemblyVersion>/);
  assert.equal(packageJson.version, "0.1.5");
  assert.match(publish, /<ModVersion Value="0\.1\.5" \/>/);
  assert.match(mod, /const string Id = "planboard"/);
  assert.match(contracts, /group: "planboard"/);
  assert.match(labels, /`Planboard\.UI\.\$\{key\}`/);
  assert.match(publish, /<GameVersion Value="1\.6\.\*" \/>/);
  assert.match(publish, /Planboard is a location-aware planning board/);
  assert.match(publish, /<Thumbnail Value="Properties\/Thumbnail\.png" \/>/);
  assert.doesNotMatch(publish, /<Screenshot Value=/);
  assert.match(publish, /0\.1\.5 - 2026-08-13/);
  assert.doesNotMatch(publish, /See (LongDescription|Changelog)\.md/);
  assert.match(ignore, /^Inspiration\/$/m);
  await read("../Code/LongDescription.md");
  await read("../Code/Changelog.md");
});

// Readability enforcement belongs in CI so it is not dependent on an individual editor setup.
test("formatting rules and CI checks keep maintained source readable", async () => {
  const packageJson = JSON.parse(await read("../UI/package.json"));
  const prettier = JSON.parse(await read("../.prettierrc.json"));
  const editorconfig = await read("../.editorconfig");
  const workflow = await read("../.github/workflows/verify.yml");
  const nativeWorkflow = await read("../.github/workflows/native-verify.yml");
  const panelSources = await Promise.all([
    read("../UI/src/components/MainPanel.tsx"),
    read("../UI/src/components/TaskEditors.tsx"),
    read("../UI/src/components/DeadlineCalendar.tsx"),
    read("../UI/src/components/DataIssuesPanel.tsx"),
  ]);

  assert.equal(packageJson.scripts.format.includes("prettier --write"), true);
  assert.equal(packageJson.scripts["format:check"].includes("prettier --check"), true);
  assert.equal(prettier.printWidth, 100);
  assert.match(editorconfig, /\[\*\.cs\][\s\S]*indent_size = 4/);
  assert.match(editorconfig, /\[\*\.\{ts,tsx,scss,json,cjs,yml,yaml,md\}\][\s\S]*indent_size = 2/);
  assert.match(workflow, /npm run format:check/);
  assert.match(nativeWorkflow, /dotnet restore Planboard\.sln/);
  assert.match(nativeWorkflow, /dotnet format Planboard\.sln --verify-no-changes --no-restore/);
  assert.doesNotMatch(
    panelSources.join("\n"),
    /ÃƒÆ’|Ãƒâ€š|ÃƒÂ¢Ã¢â€šÂ¬/,
    "UI source contains malformed encoded text",
  );
});

// The public README is player-facing; contributor workflow lives in the linked development guide.
test("public README links contributor-only build guidance instead of embedding it", async () => {
  const readme = await read("../README.md");
  const development = await read("../docs/DEVELOPMENT.md");
  assert.match(readme, /\[CONTRIBUTING\.md\]\(CONTRIBUTING\.md\)/);
  assert.match(readme, /\[docs\/DEVELOPMENT\.md\]\(docs\/DEVELOPMENT\.md\)/);
  assert.doesNotMatch(readme, /## Repository layout/);
  assert.match(development, /## Repository layout/);
  assert.match(development, /npm run format:check/);
});

// Icon rules are deliberately shared because Gameface hover repainting can otherwise flicker.
test("interactive icon styling is shared across Planboard surfaces", async () => {
  const iconSystem = await read("../UI/src/components/iconSystem.module.scss");
  const kindIcon = await read("../UI/src/components/KindIcon.tsx");
  const statusIcon = await read("../UI/src/components/StatusIcon.tsx");
  const mainPanel = await read("../UI/src/components/mainPanel.module.scss");
  const mainPanelComponent = await read("../UI/src/components/MainPanel.tsx");
  const toolbar = await read("../UI/src/components/mapToolbar.module.scss");
  const toolbarComponent = await read("../UI/src/components/ToggleButton.tsx");
  const taskList = await read("../UI/src/components/TaskList.tsx");
  const draftPanel = await read("../UI/src/components/DraftNotePanel.tsx");
  const entryControls = await read("../UI/src/components/EntryControls.tsx");
  const interaction = await read("../UI/src/styles/_interaction.scss");
  const mapNotes = await read("../UI/src/components/mapNotesOverlay.module.scss");
  const kindIssueIcon = await read("../UI/src/images/kind-issue.svg");
  const overlay = await read("../UI/src/components/MapNotesOverlay.tsx");

  assert.match(iconSystem, /pointer-events: none/);
  assert.match(iconSystem, /button:hover .icon/);
  assert.match(iconSystem, /transition: opacity/);
  assert.match(iconSystem, /filter: none !important/);
  assert.match(iconSystem, /box-shadow: none !important/);
  assert.match(iconSystem, /\.onLight\s*\{\s*opacity: 1/);
  assert.match(kindIcon, /iconSystem.module.scss/);
  assert.match(kindIcon, /kind-issue-dark.svg/);
  assert.doesNotMatch(kindIcon, /<svg/);
  assert.match(statusIcon, /iconSystem.module.scss/);
  assert.match(statusIcon, /<img/);
  assert.match(statusIcon, /status-open-dark.svg/);
  assert.doesNotMatch(statusIcon, /<svg/);
  assert.match(mainPanel, /\.kindChoice img/);
  assert.match(mainPanel, /\.statusChoice img/);
  assert.match(mainPanel, /button\.segmentActive:hover[\s\S]*background-color: #dceef5 !important/);
  assert.match(
    mainPanel,
    /priorityHigh\.segmentActive:hover[\s\S]*background-color: rgba\(255, 125, 134, 0\.29\) !important/,
  );
  assert.match(mainPanel, /\.taskRow:hover[\s\S]*background-color: transparent/);
  assert.match(toolbar, /footerButton > img[\s\S]*pointer-events: none/);
  assert.match(toolbarComponent, /<Button[\s\S]*src=\{pinIcon\}/);
  assert.match(toolbarComponent, /<Button[\s\S]*src=\{notepadIcon\}/);
  assert.match(toolbarComponent, /KindIcon[\s\S]*onLight/);
  assert.match(taskList, /KindIcon kind=\{entry.kind\} onLight/);
  assert.match(taskList, /Binding\.setStatus, entry\.id, status/);
  assert.match(taskList, /createPortal/);
  assert.match(taskList, /ListPopoverKind/);
  assert.match(taskList, /ref=\{statusTrigger\} className=\{styles\.rowStatusControl\}/);
  assert.match(taskList, /ref=\{menuTrigger\} className=\{styles\.rowMenuControl\}/);
  assert.match(taskList, /window\.addEventListener\("mousedown", dismiss\)/);
  assert.match(taskList, /Math\.max\(minimumWidth, triggerBounds\.width\)/);
  assert.match(taskList, /minimumWidth=\{94\}/);
  assert.match(taskList, /rowStatusMenu/);
  assert.match(taskList, /rowStatusIndicator[\s\S]*aria-hidden="true"/);
  assert.doesNotMatch(taskList, /statusMenu \? "-" : "\+"/);
  assert.match(mainPanel, /\.taskRow\s*\{[\s\S]*height:\s*44rem[\s\S]*flex:\s*0 0 44rem/);
  assert.match(mainPanel, /\.rowOpen\s*\{[\s\S]*height:\s*44rem[\s\S]*padding:\s*7rem/);
  assert.match(mainPanel, /\.rowStatus\s*\{[\s\S]*height:\s*28rem/);
  assert.match(mainPanel, /\.rowMenuButton\s*\{[\s\S]*height:\s*28rem/);
  assert.match(mainPanelComponent, /\["all", "open", "doing", "done"\]/);
  assert.match(
    mainPanelComponent,
    /doing: entries\.filter\(\(x\) => x\.status === EntryStatus\.Doing\)/,
  );
  assert.match(toolbarComponent, /pinControl\.current\?\.contains/);
  assert.match(
    mainPanelComponent,
    /showFilters \? \([\s\S]*styles\.filterArea[\s\S]*categoryChips/,
  );
  assert.match(mainPanel, /\.filterArea \{[\s\S]*background-color: rgba\(0, 0, 0, 0\.16\)/);
  assert.match(draftPanel, /KindIcon kind=\{value as EntryKind\} onLight/);
  assert.match(entryControls, /KindIcon kind=\{next as EntryKind\} onLight=\{next === value\}/);
  assert.match(
    entryControls,
    /StatusIcon status=\{next as EntryStatus\} onLight=\{next === value\}/,
  );
  assert.doesNotMatch(interaction, /translateY|transform 0\.14s/);
  assert.doesNotMatch(toolbar, /footerButton(?:Neutral|Active|:hover) img[\s\S]*brightness\(/);
  assert.match(mapNotes, /.cardKind.issue/);
  assert.match(mapNotes, /.marker:focus/);
  assert.doesNotMatch(mapNotes, /filter:/);
  assert.match(kindIssueIcon, /shape-rendering="geometricPrecision"/);
  assert.match(overlay, /styles.cardKind.*kindClass/);
  assert.doesNotMatch(overlay, /styles\.cardKind[\s\S]{0,100}onLight/);
});

test("selected and semantic icon surfaces meet the Planboard contrast floor", async () => {
  const iconSystem = await read("../UI/src/components/iconSystem.module.scss");
  const mainPanel = await read("../UI/src/components/mainPanel.module.scss");
  const toolbar = await read("../UI/src/components/mapToolbar.module.scss");
  const mapNotes = await read("../UI/src/components/mapNotesOverlay.module.scss");
  const kindIssueIcon = await read("../UI/src/images/kind-issue.svg");
  const hex = (value) =>
    [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset + 1, offset + 3), 16) / 255);
  const luminance = (rgb) => {
    const linear = rgb.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (foreground, background) => {
    const [light, dark] = [luminance(hex(foreground)), luminance(hex(background))].sort(
      (a, b) => b - a,
    );
    return (light + 0.05) / (dark + 0.05);
  };

  assert.ok(contrast("#000000", "#eaf7fc") >= 4.5);
  assert.ok(contrast("#062219", "#64d9a4") >= 4.5);
  assert.ok(contrast("#2a090c", "#ff7d86") >= 4.5);
  assert.ok(contrast("#291a02", "#f0b65d") >= 4.5);
  assert.ok(contrast("#64252b", "#ff7d86") >= 4.5);
  assert.ok(contrast("#064654", "#64d9a4") >= 4.5);
  assert.ok(contrast("#5a3800", "#f0b65d") >= 4.5);
  assert.match(mainPanel, /\.kindIssue[\s\S]*background-color: \$red/);
  assert.match(mainPanel, /\.kindNote[\s\S]*background-color: \$green/);
  assert.match(mainPanel, /\.kindIdea[\s\S]*background-color: \$amber/);
  assert.match(iconSystem, /filter: none !important/);
  assert.match(kindIssueIcon, /shape-rendering="geometricPrecision"/);
});

test("panel chrome uses shared typography and compact action tokens", async () => {
  const mainPanel = await read("../UI/src/components/MainPanel.tsx");
  const draftPanel = await read("../UI/src/components/DraftNotePanel.tsx");
  const mainStyles = await read("../UI/src/components/mainPanel.module.scss");
  const draftStyles = await read("../UI/src/components/draftNote.module.scss");
  const tokens = await read("../UI/src/styles/_tokens.scss");
  const settings = await read("../Code/Settings.cs");

  assert.doesNotMatch(mainPanel, /City Tasks & Map Notes|Subtitle/);
  assert.doesNotMatch(draftPanel, /Complete the note/);
  assert.doesNotMatch(settings, /Planboard\.UI\.Subtitle/);
  assert.match(tokens, /\$font-panel-title: 15rem/);
  assert.match(tokens, /\$action-height: 28rem/);
  assert.match(tokens, /\$compact-action-inset: 8rem/);
  assert.match(tokens, /\$radius-micro: 3rem/);
  assert.match(tokens, /\$radius-compact: \$radius-control/);
  assert.match(tokens, /\$radius-control: 8rem/);
  assert.match(tokens, /\$radius-card: 12rem/);
  assert.match(tokens, /\$radius-circle: 50%/);
  assert.match(tokens, /\$radius-pill: 999rem/);
  assert.match(tokens, /\$editor-gutter: 15rem/);
  assert.match(tokens, /@mixin action-button/);
  assert.match(tokens, /@mixin compact-text-action/);
  assert.match(mainStyles, /font-size: tokens\.\$font-panel-title/);
  assert.match(mainStyles, /background-color: tokens\.\$panel-footer-background/);
  assert.match(draftStyles, /font-size: tokens\.\$font-panel-title/);
  assert.match(draftStyles, /background-color: tokens\.\$panel-footer-background/);
  assert.match(draftStyles, /@include tokens\.action-button/);
  assert.match(mainStyles, /\.filterButton\s*\{\s*@include tokens\.compact-text-action/);
  assert.match(mainStyles, /\.resetWindow\s*\{\s*@include tokens\.compact-text-action/);
  assert.match(mainStyles, /\.deleteButton\s*\{\s*@include tokens\.compact-text-action/);
  assert.match(mainStyles, /border-radius: tokens\.\$radius-control/);
  assert.doesNotMatch(mainStyles, /border-radius:\s*\d+rem/);
  assert.match(mainStyles, /\.grid \{[\s\S]*display: flex[\s\S]*flex-wrap: wrap/);
  assert.match(mainStyles, /\.grid > \* \{[\s\S]*width: 49%[\s\S]*margin-right: 2%/);
  assert.match(mainStyles, /padding: 8rem tokens\.\$editor-gutter/);
  assert.match(
    mainStyles,
    /\.taskMain \{[\s\S]*height: 30rem[\s\S]*justify-content: space-between/,
  );
  assert.match(mainStyles, /\.kindBadge \{[\s\S]*width: 30rem[\s\S]*height: 30rem/);
  assert.match(mainStyles, /\.taskMain strong \{[\s\S]*line-height: 14rem/);
  assert.match(mainStyles, /\.taskMain span \{[\s\S]*line-height: 10rem/);
});
