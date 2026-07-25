// Guards the `prepare` lifecycle script so it degrades gracefully when
// devDependencies aren't installed — which is the case when npm prepares
// this package as a *global git-URL* install (npm's git-dependency prepare
// step does not install this package's own dependencies into that
// temporary directory, so `tsc` and everything it needs to compile are
// unavailable there). In that situation we fall back to the `dist/` that's
// already committed to git instead of failing the install.
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const typescriptEntry = fileURLToPath(
  new URL("../node_modules/typescript/package.json", import.meta.url),
);

if (existsSync(typescriptEntry)) {
  execSync("npm run build", { stdio: "inherit" });
} else {
  console.log(
    "[harness-stack] devDependencies aren't installed (expected when " +
      "installing globally from a git URL) — using the dist/ already " +
      "committed to git instead of building from source.",
  );
}
