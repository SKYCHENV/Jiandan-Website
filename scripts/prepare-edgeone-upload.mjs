import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist", "edgeone");
const functionDirectory = path.join(output, "edge-functions", "api", "auth");

await rm(output, { recursive: true, force: true });
await mkdir(functionDirectory, { recursive: true });
await cp(path.join(root, "dist", "client"), output, { recursive: true });

await build({
  entryPoints: [path.join(root, "edge-functions", "api", "auth", "[[default]].js")],
  outfile: path.join(functionDirectory, "[[default]].js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  define: {
    __JIANDAN_BREVO_API_KEY__: JSON.stringify(process.env.JIANDAN_BUILD_BREVO_API_KEY || ""),
    __JIANDAN_BREVO_FROM_EMAIL__: JSON.stringify(process.env.JIANDAN_BUILD_BREVO_FROM_EMAIL || ""),
    __JIANDAN_BREVO_FROM_NAME__: JSON.stringify(process.env.JIANDAN_BUILD_BREVO_FROM_NAME || ""),
    __JIANDAN_ADMIN_EMAILS__: JSON.stringify(process.env.JIANDAN_BUILD_ADMIN_EMAILS || ""),
  },
  logLevel: "info",
});

console.log(`Prepared EdgeOne upload: ${output}`);
