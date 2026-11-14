import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, fontProviders } from "astro/config"

export default defineConfig({
  site: "https://leafage.garden",
  trailingSlash: "never",
  build: { inlineStylesheets: "always" },
  security: { csp: { directives: ["default-src 'none'", "img-src 'self'", "font-src 'self'"] } },
  fonts: [
    {
      name: "Inter",
      cssVariable: "--font-inter",
      provider: fontProviders.fontsource(),
      weights: ["400 500"],
      styles: ["normal"],
      subsets: ["latin"],
    },
  ],
  markdown: { syntaxHighlight: false },
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
})
