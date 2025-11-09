import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import EnvironmentPlugin from "vite-plugin-environment";
import path, { join, resolve } from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dfxJson = JSON.parse(
  readFileSync(path.resolve(__dirname, "dfx.json"), "utf8"),
);

let localCanisters: any, prodCanisters: any, canisters: any;
let localEnv = true;
let network = "local";

function initCanisterIds() {
  try {
    localCanisters = JSON.parse(
      readFileSync(path.resolve(".dfx", "local", "canister_ids.json"), "utf8"),
    );
  } catch (error) {
    console.log("No local canister_ids.json found.");
  }
  try {
    prodCanisters = JSON.parse(
      readFileSync(path.resolve("canister_ids.json"), "utf8"),
    );
    localEnv = false;
  } catch (error) {
    console.log("No production canister_ids.json found.");
  }

  network = process.env.NODE_ENV === "production" && !localEnv ? "ic" : "local";
  canisters = network !== "ic" || localEnv ? localCanisters : prodCanisters;

  for (const canister in canisters) {
    process.env[canister.toUpperCase() + "_CANISTER_ID"] =
      canisters[canister][network];
  }
}

const isDevelopment = process.env.NODE_ENV !== "production" || localEnv;
initCanisterIds();

export default defineConfig({
  publicDir: "public",
  build: {
    outDir: "build",
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4943",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/frontend"),
      ...Object.entries(dfxJson.canisters).reduce((acc, [name]) => {
        const networkName = process.env.DFX_NETWORK || "local";
        const outputRoot = join(
          __dirname,
          ".dfx",
          networkName,
          "canisters",
          name,
        );
        return { ...acc, [`canisters/${name}`]: join(outputRoot, "index.js") };
      }, {}),
    },
  },
  define: {
    global: "globalThis",
    ...Object.entries(canisters || {}).reduce(
      (acc, [key, val]: [string, any]) => ({
        ...acc,
        [`process.env.${key.toUpperCase()}_CANISTER_ID`]: JSON.stringify(
          isDevelopment ? val.local : val.ic,
        ),
      }),
      {},
    ),
    "process.env.NODE_ENV": JSON.stringify(
      isDevelopment ? "development" : "production",
    ),
  },
  plugins: [
    react(),
    EnvironmentPlugin("all", { prefix: "CANISTER_" }),
    EnvironmentPlugin("all", { prefix: "DFX_" }),
    EnvironmentPlugin({ BACKEND_CANISTER_ID: "" }),
  ],
});
