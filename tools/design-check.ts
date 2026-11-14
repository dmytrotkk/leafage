import { Glob } from "bun"

const SPACE = new Set(["0", "2", "4", "6"])
const RULES: [string, RegExp, (match: RegExpExecArray) => boolean][] = [
  ["spacing must be 0, 2, 4 or 6", /(?<![\w-])-?(?:gap|gap-x|gap-y|space-x|space-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-(\d+(?:\.\d+)?)(?![\w-])/g, (m) => !SPACE.has(m[1]!)],
  ["radius must be lg, full or inset", /(?<![\w-])rounded(?:-(?:tl|tr|br|bl|ss|se|es|ee|t|r|b|l|s|e))?(?:-(\w+))?(?![\w-])/g, (m) => m[1] !== "lg" && m[1] !== "full" && m[1] !== "inset"],
  ["text size must be xs, sm, base, xl or 2xl", /(?<![\w-])text-(?:lg|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[[^\]]*(?:rem|px|em)\])(?![\w-])/g, () => true],
  ["font weight must be normal or medium", /(?<![\w-])font-(?:thin|extralight|light|semibold|bold|extrabold|black)(?![\w-])/g, () => true],
  ["text colour is foreground or muted-foreground, no opacity", /(?<![\w-])text-(?:foreground|muted-foreground|background|card-foreground)\/[\w.[\]]+/g, () => true],
]

const DATA_VIZ = new Set(["src/components/segment-strip.tsx"])

let failures = 0
for await (const path of new Glob("{src,sites/landing/src}/**/*.{ts,tsx,astro}").scan(".")) {
  if (DATA_VIZ.has(path)) continue
  const lines = (await Bun.file(path).text()).split("\n")
  lines.forEach((line, i) => {
    for (const [rule, pattern, offends] of RULES) {
      for (const match of line.matchAll(pattern)) {
        if (!offends(match)) continue
        failures++
        console.log(`${path}:${i + 1}: ${match[0]} (${rule})`)
      }
    }
  })
}
if (failures) {
  console.log(`${failures} design violations`)
  process.exit(1)
}
console.log("design check: clean")
