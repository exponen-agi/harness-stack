/** Small filesystem + YAML helpers shared across the harness. */
import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";
export async function pathExists(p) {
    try {
        await fs.access(p);
        return true;
    }
    catch {
        return false;
    }
}
export async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}
export async function readYaml(file) {
    const text = await fs.readFile(file, "utf8");
    return YAML.parse(text);
}
export function dumpYaml(value) {
    return YAML.stringify(value, { lineWidth: 0 });
}
export async function writeYaml(file, value) {
    await ensureDir(path.dirname(file));
    await fs.writeFile(file, dumpYaml(value), "utf8");
}
export async function listFiles(dir, ext) {
    if (!(await pathExists(dir)))
        return [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
        .filter((e) => e.isFile() && e.name.endsWith(ext))
        .map((e) => path.join(dir, e.name))
        .sort();
}
/** Write a file only if it does not already exist. Returns true if written. */
export async function writeIfAbsent(file, contents) {
    if (await pathExists(file))
        return false;
    await ensureDir(path.dirname(file));
    await fs.writeFile(file, contents, "utf8");
    return true;
}
//# sourceMappingURL=fsx.js.map