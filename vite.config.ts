import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { cloudflare } from "@cloudflare/vite-plugin"

import pkg from "./package.json" with { type: "json" }

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD__: JSON.stringify(Date.now().toString(36)),
  },
  ...(process.env.PORT && { server: { port: Number(process.env.PORT) } }),
  resolve: {
    tsconfigPaths: true,
  },
  experimental: {
    renderBuiltUrl: (_filename, { hostType }) => (hostType === "js" ? { relative: true } : undefined),
  },
  environments: {
    client: {
      build: {
        rolldownOptions: {
          input: ["index.html", "embed.html"],
          output: {
            codeSplitting: {
              groups: [
                { name: "supabase", test: /node_modules[\\/]@supabase[\\/]/ },
                { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              ],
            },
          },
        },
      },
    },
  },
})
