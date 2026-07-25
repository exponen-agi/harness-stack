/** Locates the bundled `templates/` directory in both src and dist layouts. */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pathExists } from "./util/fsx.js";
/**
 * Resolve the templates dir. Works whether running from `src/` (tsx) or
 * `dist/` (built): both sit one level below the package root.
 */
export async function templatesDir() {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        path.join(here, "..", "templates"), // src/ or dist/ → ../templates
        path.join(here, "..", "..", "templates"),
    ];
    for (const c of candidates) {
        if (await pathExists(c))
            return c;
    }
    throw new Error(`Could not locate the harness templates directory.`);
}
//# sourceMappingURL=templates.js.map