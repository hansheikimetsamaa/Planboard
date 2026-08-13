import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Bindings cross the C# to Gameface boundary as strings. This prevents a renamed endpoint
// from failing only after the mod is loaded in-game.
test("C# and TypeScript binding values stay in parity", async () => {
  const csharp = await readFile(
    new URL("../Code/Common/UIBindingConstants.cs", import.meta.url),
    "utf8",
  );
  const typescript = await readFile(
    new URL("../UI/src/types/contracts.ts", import.meta.url),
    "utf8",
  );
  const csharpValues = [...csharp.matchAll(/const string \w+ = "([^"]+)"/g)].map(
    (match) => match[1],
  );
  for (const value of csharpValues)
    assert.match(typescript, new RegExp(`"${value}"`), `missing TypeScript binding value ${value}`);
});
