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
    __JIANDAN_RESEND_API_KEY__: JSON.stringify(process.env.JIANDAN_BUILD_RESEND_API_KEY || ""),
    __JIANDAN_AUTH_EMAIL_FROM__: JSON.stringify(process.env.JIANDAN_BUILD_AUTH_EMAIL_FROM || ""),
  },
  logLevel: "info",
});

console.log(`Prepared EdgeOne upload: ${output}`);
