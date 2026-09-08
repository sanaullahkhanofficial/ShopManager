import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Electron loads the production renderer from a file:// URL.
  // Relative asset paths are required so the React bundle works inside the packaged app.
  base: "./"
});
