import { describe, it, expect } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

// MCP servers run with your tools and secrets. The curated allowlist must not
// ship anything that fetches "whatever is newest" or talks over plain HTTP.

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, "..", "templates", "allowlists", "mcp-servers.yaml");

interface Server {
  name: string;
  mode: "url" | "npx" | "stdio";
  url?: string;
  package?: string;
}

describe("templates/allowlists/mcp-servers.yaml", () => {
  it("url servers use https", async () => {
    const { servers } = YAML.parse(await fs.readFile(file, "utf8")) as { servers: Server[] };
    for (const s of servers.filter((x) => x.mode === "url")) {
      expect(s.url, s.name).toMatch(/^https:\/\//);
    }
  });

  it("npx servers pin an exact version (name@x.y.z)", async () => {
    const { servers } = YAML.parse(await fs.readFile(file, "utf8")) as { servers: Server[] };
    for (const s of servers.filter((x) => x.mode === "npx")) {
      expect(s.package, s.name).toMatch(/^@?[\w./-]+@\d+\.\d+\.\d+$/);
    }
  });
});
