import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

import * as child from "child_process";

const commitHash = child.execSync("git rev-parse --short HEAD").toString();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
});
