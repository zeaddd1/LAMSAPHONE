/**
 * Rebrands the Medusa admin texts before `medusa build`.
 * Replaces the "Medusa" brand in the dashboard translations with the store name.
 * Runs at image build time only (see Dockerfile). Safe to run more than once.
 */
const fs = require("fs")
const path = require("path")

const root = path.join(__dirname, "..", "node_modules", "@medusajs", "dashboard")
const replacements = [
  ["مدوسا", "لمسة فون"],
  ["Welcome to Medusa", "Welcome to Lamsa Phone"],
]

let files = 0
let hits = 0
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(p)
      continue
    }
    if (!/\.(m?js|cjs|json)$/.test(entry.name) || entry.name.endsWith(".map")) continue
    let text = fs.readFileSync(p, "utf8")
    let changed = false
    for (const [from, to] of replacements) {
      if (text.includes(from)) {
        hits += text.split(from).length - 1
        text = text.split(from).join(to)
        changed = true
      }
    }
    if (changed) {
      fs.writeFileSync(p, text)
      files++
    }
  }
}

if (fs.existsSync(root)) {
  walk(root)
  console.log(`brand-admin: ${hits} replacements in ${files} files`)
} else {
  console.log("brand-admin: @medusajs/dashboard not found, skipped")
}
