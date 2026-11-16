// Checks companies.json before a pull request is merged. Run: bun validate.ts [path-to-companies.json]
// Rules: the schema (schema.ts), and every company fact's url sits on that company's own site.
import { parseRecords, FACT_KEYS } from "./schema.ts"

const path = process.argv[2] ?? "companies.json"
const problems: string[] = []
let recs
try {
  recs = parseRecords(JSON.parse(await Bun.file(path).text()))
} catch (e) {
  console.error(`${path}: ${(e as Error).message}`)
  process.exit(1)
}

// The part of a host that names the organisation: example.ca for www.example.ca and app.example.ca. Two-part public suffixes (co.uk) are not in the list, so they are compared whole.
const registrable = (u: string) => {
  const h = new URL(u).hostname.toLowerCase().replace(/^www\./, "")
  return h.split(".").slice(-2).join(".")
}
for (const r of recs) {
  const own = registrable(r.site)
  for (const k of FACT_KEYS) {
    for (const f of r.facts[k]) {
      if (registrable(f.url) !== own) problems.push(`${r.slug}: ${k} fact url ${f.url} is not on the company's own site (${r.site}); a fact must come from the company's own pages`)
    }
  }
}
if (problems.length) {
  console.error(problems.join("\n"))
  process.exit(1)
}
console.log(`${path}: ${recs.length} companies, ${recs.reduce((n, r) => n + FACT_KEYS.reduce((m, k) => m + r.facts[k].length, 0), 0)} facts, all pass`)
