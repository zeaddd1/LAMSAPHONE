/**
 * يبني معجم اللهجات الخفيف للرد الآلي من حزم المعجم في مشروع YBHub (core + yemeni + saudi + gulf).
 * يُشغَّل يدوياً عند تحديث المعجم فقط، ويكتب ملفاً واحداً صغيراً: src/lib/assistant/lexicon.ts
 * لا يحتاج YBHub وقت التشغيل.
 *   node build-tools/build-lexicon.mjs D:/APP/YBHub/datasets/lexicons
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const dir = process.argv[2]
if (!dir) throw new Error("usage: node build-tools/build-lexicon.mjs <lexicons dir>")
const PACKS = ["core", "yemeni", "saudi", "gulf"] // سوقنا: اليمن والسعودية والخليج
// نية YBHub ← مفهوم الرد الآلي (نتجاهل ما يخص حسابات التجار: balance, statement)
const MAP = {
  price: "price",
  stock: "available",
  order: "order",
  order_status: "followup", // "وين طلبي / متى يوصل" = موظف إن لم يجب سؤال شائع
  hours: "hours",
  help: "human",
  info: "location",
  catalog: "list",
  offers: "list",
  services: "delivery",
  greeting: "greeting",
  _thanks: "thanks",
}
// عبارات واسعة جداً تسبب فهماً خاطئاً في متجر جوالات
const SKIP = new Set(["ارسل لي", "ارسل", "عندكم", "عندك", "خلص", "رسل لي", "info", "help"])

const synonyms = {}
const phrases = {}
const versions = []
for (const p of PACKS) {
  const pack = JSON.parse(readFileSync(join(dir, `${p}.json`), "utf8"))
  versions.push(`${p}@${pack.version}`)
  for (const [variant, canon] of Object.entries(pack.synonyms || {})) if (variant !== canon) synonyms[variant] = canon
  for (const [intent, list] of Object.entries(pack.intents || {})) {
    const concept = MAP[intent]
    if (!concept) continue
    const set = new Set(phrases[concept] || [])
    for (const ph of list) if (!SKIP.has(ph.trim())) set.add(ph.trim())
    phrases[concept] = [...set]
  }
}

const out = `// مولَّد تلقائياً بواسطة build-tools/build-lexicon.mjs من معجم YBHub (${versions.join("، ")}). لا تعدّله يدوياً.
// synonyms: كلمة لهجة ← الكلمة الفصحى. phrases: عبارات كل مفهوم.
export const LEXICON_VERSION = ${JSON.stringify(versions.join(" "))}
export const LEX_SYNONYMS: Record<string, string> = ${JSON.stringify(synonyms)}
export const LEX_PHRASES: Record<string, string[]> = ${JSON.stringify(phrases)}
`
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "assistant", "lexicon.ts")
writeFileSync(target, out)
console.log(`lexicon.ts: ${Object.keys(synonyms).length} synonyms, ${Object.values(phrases).flat().length} phrases, ${Buffer.byteLength(out)} bytes`)
