// The one parser for site-data/companies.json (#4448, design act 30407). collect.ts writes through it and Pennant's build.ts
// reads through it, so one set of rules decides what a valid record is. Plain TypeScript, no packages.

export type Slug = string // a-z, 0-9 and single dashes
export type Url = string // https only
export type IsoDate = string // YYYY-MM-DD
export type Phone = string // 10 digits
export const PROVINCES = ["BC", "AB", "SK", "MB", "ON", "QC", "NB", "NS", "PE", "NL", "YT", "NT", "NU"] as const
export type Province = (typeof PROVINCES)[number]
export const STAGES = ["Startup", "Small Business", "Midsize", "Enterprise", "Public"] as const // the canada.ca list's own words and casing
// The list misspells a stage on one row (Colleaga: "Strartup"); import reads it through this map. Keys are lower case.
export const STAGE_SPELLING: Record<string, Stage> = { "strartup": "Startup" }
export type Stage = (typeof STAGES)[number]

// canadian, partly: the quote says Canada (wholly or in part). elsewhere: the quote names a place that is not Canada. notStated: it names no place.
export const MARKS = ["canadian", "partly", "elsewhere", "notStated"] as const
export type Mark = { kind: (typeof MARKS)[number] }
export type FactStatus =
  | { kind: "current" }
  | { kind: "changed"; was: string; on: IsoDate } // the page reads and the quote is no longer on it; was = the old quote
  | { kind: "gone"; since: IsoDate } // the page answers 404/410, or its host no longer resolves
export type Fact = { value: string; mark: Mark; url: Url; quote: string; checkedAt: IsoDate; status: FactStatus }
export type LangFact = Fact & { value: "en" | "fr" }
export type ContactFact = Fact & { reach: "person" | "generalLine" | "contactPage"; name: string | null; phone: Phone | null }
export type FactKey = "owner" | "data" | "models" | "law" | "languages" | "contact"
export const FACT_KEYS: FactKey[] = ["owner", "data", "models", "law", "languages", "contact"]
// name is the publisher as it reads after "Listed with": "the Government of Canada", "BetaKit", "CAISIC". title is the list's own title, shown when a reader hovers the link.
// A product a company makes (#4697, from #4682). Two quoted lines: what it does, and what it costs ("not stated" when the pricing page names no price). The mark belongs to the maker, so a product line has none.
export const GROUPS = ["chat-writing", "team-docs", "model", "clinic-notes", "images"] as const // the use groups on the alternatives pages (clinic-notes and images: Pennant, #4682)
export type Group = (typeof GROUPS)[number]
export const TOOLS = ["ChatGPT", "Microsoft Copilot", "Otter", "Grammarly", "Midjourney", "Google Gemini", "Claude", "Notion AI", "Zoom AI Companion", "Jasper", "Fireflies"] as const // the tools the alternatives pages answer; one list, Pennant's
export type Tool = (typeof TOOLS)[number]
/** How each tool is named on its page and in its address: "Otter" is searched as "Otter.ai". One entry a tool, so a new tool in TOOLS needs its name here. */
export const TOOL_NAME: Record<Tool, string> = { ChatGPT: "ChatGPT", "Microsoft Copilot": "Microsoft Copilot", Otter: "Otter.ai", Grammarly: "Grammarly", Midjourney: "Midjourney", "Google Gemini": "Google Gemini", Claude: "Claude", "Notion AI": "Notion AI", "Zoom AI Companion": "Zoom AI Companion", Jasper: "Jasper", Fireflies: "Fireflies" }
export type ProductFact = Omit<Fact, "mark">
export type Product = { name: string; url: Url; group: Group; alternativeTo: Tool[]; does: ProductFact; price: ProductFact; readAt: IsoDate }
export type Listing = { name: string; title: string; url: Url; checkedAt: IsoDate }
export type Rec = {
  slug: Slug
  name: string
  site: Url
  profile: { business_type: string; sector: string; stage: Stage; hq: string; province: Province | null } // what the company is and where; every record has one
  listings: Listing[] // who lists the company, at least one (#4679)
  jobsBoard: Url | null
  newsroom: Url | null
  readAt: IsoDate | null // the day a reader last read the company's own pages for facts; null when nobody has
  products: Product[] // what the company sells that an alternatives page may show; empty when nobody has read them
  facts: { owner: Fact[]; data: Fact[]; models: Fact[]; law: Fact[]; languages: LangFact[]; contact: ContactFact[] }
}
export type ParseError = { slug: string; field: string; got: unknown; rule: string }

export class SchemaError extends Error {
  constructor(public readonly e: ParseError) {
    super(`${e.slug}: ${e.field} ${e.rule} (got ${JSON.stringify(e.got)})`)
  }
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
export const isDate = (s: unknown): s is IsoDate => typeof s === "string" && DATE.test(s) && !Number.isNaN(Date.parse(s))
export const isUrl = (s: unknown): s is Url => {
  if (typeof s !== "string") return false
  try { return new URL(s).protocol === "https:" } catch { return false }
}
/** "(587) 807-0882" and "+1 587 807 0882" both give "5878070882"; anything that is not 10 digits after that gives null. */
export function cleanPhone(s: string): Phone | null {
  let d = s.replace(/\D/g, "")
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1)
  return d.length === 10 ? d : null
}

/** A famous tool read on the same six questions (#4709), for the lineup's first row on its alternatives page. It is not a company in the directory: no profile, no page, never counted. */
export type Compared = { name: string; slug: string; tool: Tool; site: Url; privacy: Url; readAt: IsoDate; facts: Rec["facts"] }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)

function parseFact(slug: string, where: string, v: unknown, key: FactKey | "product"): Fact {
  const bad = (field: string, got: unknown, rule: string): never => { throw new SchemaError({ slug, field: `${where}.${field}`, got, rule }) }
  if (!isObj(v)) return bad("", v, "is an object")
  if (typeof v.value !== "string" || v.value === "") bad("value", v.value, "is a non-empty string")
  if (key === "languages" && v.value !== "en" && v.value !== "fr") bad("value", v.value, "is en or fr")
  if (key !== "product" && (!isObj(v.mark) || !(MARKS as readonly unknown[]).includes(v.mark.kind))) bad("mark", v.mark, `is one of ${MARKS.join(", ")}`)
  if (!isUrl(v.url)) bad("url", v.url, "is an https url")
  if (typeof v.quote !== "string" || v.quote === "") bad("quote", v.quote, "is a non-empty string")
  if (!isDate(v.checkedAt)) bad("checkedAt", v.checkedAt, "is YYYY-MM-DD")
  const st = v.status
  if (!isObj(st)) return bad("status", st, "is an object")
  if (st.kind === "changed" && (typeof st.was !== "string" || !isDate(st.on))) bad("status", st, "changed carries was and on")
  else if (st.kind === "gone" && !isDate(st.since)) bad("status", st, "gone carries since")
  else if (st.kind !== "current" && st.kind !== "changed" && st.kind !== "gone") bad("status", st, "is current, changed or gone")
  if (key === "contact") {
    if (!["person", "generalLine", "contactPage"].includes(v.reach as string)) bad("reach", v.reach, "is person, generalLine or contactPage")
    if (v.name !== null && typeof v.name !== "string") bad("name", v.name, "is a string or null")
    if (v.phone !== null && (typeof v.phone !== "string" || cleanPhone(v.phone) !== v.phone)) bad("phone", v.phone, "is 10 digits or null")
  }
  return v as unknown as Fact
}

export function parseRecords(raw: unknown): Rec[] {
  if (!Array.isArray(raw)) throw new SchemaError({ slug: "-", field: "", got: typeof raw, rule: "is an array of records" })
  const seen = new Set<string>()
  return raw.map((r, i) => {
    const slug = isObj(r) && typeof r.slug === "string" ? r.slug : `#${i}`
    const bad = (field: string, got: unknown, rule: string): never => { throw new SchemaError({ slug, field, got, rule }) }
    if (!isObj(r)) return bad("", r, "is an object")
    if (!SLUG.test(slug)) bad("slug", slug, "is a-z, 0-9 and single dashes")
    if (seen.has(slug)) bad("slug", slug, "is listed once")
    seen.add(slug)
    if (typeof r.name !== "string" || r.name === "") bad("name", r.name, "is a non-empty string")
    if (!isUrl(r.site)) bad("site", r.site, "is an https url")
    const g = r.profile
    if (!isObj(g)) return bad("profile", g, "is an object")
    for (const k of ["business_type", "sector", "stage", "hq"]) if (typeof g[k] !== "string") bad(`profile.${k}`, g[k], "is a string")
    if (!(STAGES as readonly unknown[]).includes(g.stage)) bad("profile.stage", g.stage, `is one of ${STAGES.join(", ")}`)
    if (g.province !== null && !(PROVINCES as readonly unknown[]).includes(g.province)) bad("profile.province", g.province, "is a province code or null")
    if (!Array.isArray(r.listings) || r.listings.length === 0) bad("listings", r.listings, "is a list with at least one listing")
    ;(r.listings as unknown[]).forEach((l, j) => {
      if (!isObj(l)) return bad(`listings[${j}]`, l, "is an object")
      if (typeof l.name !== "string" || l.name === "") bad(`listings[${j}].name`, l.name, "is a non-empty string")
      if (typeof l.title !== "string" || l.title === "") bad(`listings[${j}].title`, l.title, "is a non-empty string")
      if (!isUrl(l.url)) bad(`listings[${j}].url`, l.url, "is an https url")
      if (!isDate(l.checkedAt)) bad(`listings[${j}].checkedAt`, l.checkedAt, "is YYYY-MM-DD")
    })
    for (const k of ["jobsBoard", "newsroom"]) if (r[k] !== null && !isUrl(r[k])) bad(k, r[k], "is an https url or null")
    if (r.readAt !== null && !isDate(r.readAt)) bad("readAt", r.readAt, "is YYYY-MM-DD or null")
    if (!isObj(r.facts)) return bad("facts", r.facts, "is an object")
    for (const key of FACT_KEYS) {
      const list = r.facts[key]
      if (!Array.isArray(list)) bad(`facts.${key}`, list, "is a list")
      ;(list as unknown[]).forEach((f, j) => parseFact(slug, `facts.${key}[${j}]`, f, key))
    }
    if (!Array.isArray(r.products)) bad("products", r.products, "is a list")
    ;(r.products as unknown[]).forEach((p, j) => {
      const at = `products[${j}]`
      if (!isObj(p)) return bad(at, p, "is an object")
      if (typeof p.name !== "string" || p.name === "") bad(`${at}.name`, p.name, "is a non-empty string")
      if (!isUrl(p.url)) bad(`${at}.url`, p.url, "is an https url")
      if (!(GROUPS as readonly unknown[]).includes(p.group)) bad(`${at}.group`, p.group, `is one of ${GROUPS.join(", ")}`)
      if (!Array.isArray(p.alternativeTo) || p.alternativeTo.length === 0 || !p.alternativeTo.every(t => (TOOLS as readonly unknown[]).includes(t))) bad(`${at}.alternativeTo`, p.alternativeTo, `is a list of at least one of ${TOOLS.join(", ")}`)
      if (!isDate(p.readAt)) bad(`${at}.readAt`, p.readAt, "is YYYY-MM-DD")
      for (const k of ["does", "price"]) parseFact(slug, `${at}.${k}`, p[k], "product")
    })
    return r as unknown as Rec
  })
}

export function parseCompared(raw: unknown): Compared[] {
  if (!Array.isArray(raw)) throw new SchemaError({ slug: "-", field: "", got: typeof raw, rule: "is an array of compared records" })
  return raw.map((r, i) => {
    const slug = isObj(r) && typeof r.slug === "string" ? r.slug : `#${i}`
    const bad = (field: string, got: unknown, rule: string): never => { throw new SchemaError({ slug, field, got, rule }) }
    if (!isObj(r)) return bad("", r, "is an object")
    if (typeof r.name !== "string" || r.name === "") bad("name", r.name, "is a non-empty string")
    if (!(TOOLS as readonly unknown[]).includes(r.tool)) bad("tool", r.tool, `is one of ${TOOLS.join(", ")}`)
    for (const k of ["site", "privacy"]) if (!isUrl(r[k])) bad(k, r[k], "is an https url")
    if (!isDate(r.readAt)) bad("readAt", r.readAt, "is YYYY-MM-DD")
    if (!isObj(r.facts)) return bad("facts", r.facts, "is an object")
    for (const key of FACT_KEYS) {
      const list = r.facts[key]
      if (!Array.isArray(list)) bad(`facts.${key}`, list, "is a list")
      ;(list as unknown[]).forEach((f, j) => parseFact(slug, `facts.${key}[${j}]`, f, key))
    }
    return r as unknown as Compared
  })
}
