import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { version?: string };

const semverPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const appVersion = semverPattern.test(pkg.version ?? "")
  ? pkg.version
  : "0.0.0";

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    port: 5173
  }
});
