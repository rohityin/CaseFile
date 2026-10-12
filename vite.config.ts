import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      // Avoid broken HMR runtime after dep re-optimization sessions
      jsxRuntime: "automatic",
    }),
  ],
  server: {
    port: 8080,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "gsap", "gsap/ScrollTrigger", "motion/react"],
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          gsap: ["gsap", "gsap/ScrollTrigger", "@gsap/react"],
          motion: ["motion"],
          icons: ["@phosphor-icons/react"],
        },
      },
    },
  },
  clearScreen: false,
});
