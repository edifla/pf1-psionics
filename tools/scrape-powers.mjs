/**
 * Gera packs-src/powers a partir da lista de poderes de disciplina do psion no d20pfsrd.
 *
 * Cada poder vira um Item "spell" do PF1 (nível, disciplina como escola, alcance, duração,
 * teste de resistência, custo em PP como spellPoints.cost) dentro de uma pasta por disciplina.
 * A descrição guarda o resumo de uma linha da lista e o link para o texto completo.
 *
 * Uso: node tools/scrape-powers.mjs
 */
import { parse } from "node-html-parser";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const LIST_URL = "https://www.d20pfsrd.com/alternative-rule-systems/3rd-party-rules-systems/psionics-unleashed/power-lists/power-list-psion-discipline-powers/";
const OUT_DIR = path.resolve("packs-src/powers");
const DELAY_MS = 300;

export const DISCIPLINES = {
  egoist: { school: "psychometabolism", folder: "Egoist (Psychometabolism)", img: "icons/magic/life/heart-area-circle-red-green.webp" },
  kineticist: { school: "psychokinesis", folder: "Kineticist (Psychokinesis)", img: "icons/magic/fire/beam-jet-stream-blue.webp" },
  nomad: { school: "psychoportation", folder: "Nomad (Psychoportation)", img: "icons/magic/movement/portal-vortex-orange.webp" },
  seer: { school: "clairsentience", folder: "Seer (Clairsentience)", img: "icons/magic/perception/eye-ringed-green.webp" },
  shaper: { school: "metacreativity", folder: "Shaper (Metacreativity)", img: "icons/magic/symbols/elements-air-earth-fire-water.webp" },
  telepath: { school: "telepathy", folder: "Telepath (Telepathy)", img: "icons/magic/perception/eye-tendrils-web-purple.webp" },
};

const SOURCES = {
  PU: "Psionics Unleashed",
  PE: "Psionics Expanded",
  "PE:APG": "Psionics Expanded: Advanced Psionics Guide",
  UP: "Ultimate Psionics",
};

// Classes que aparecem nas linhas "Level" das páginas de poder → tag do PF1.
const CLASS_TAGS = {
  psion: "psion",
  wilder: "wilder",
  "psychic warrior": "psychicWarrior",
  aegis: "aegis",
  cryptic: "cryptic",
  dread: "dread",
  marksman: "marksman",
  soulknife: "soulknife",
  tactician: "tactician",
  vitalist: "vitalist",
  voyager: "voyager",
};

const STAT_FIELDS = ["Discipline", "Level", "Display", "Manifesting Time", "Range", "Targets", "Target", "Area", "Effect", "Duration", "Saving Throw", "Power Resistance", "Power Points"];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = s => (s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const id16 = seed => createHash("sha1").update(seed).digest("hex").slice(0, 16);
const slug = s => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const escapeHtml = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (pf1-psionics builder)" } });
  return { status: res.status, html: res.ok ? await res.text() : "" };
}

/** Lê a lista e devolve [{ disc, level, name, href, augment, summary, source }]. */
function parseList(html) {
  const root = parse(html);
  const art = root.querySelector("article") ?? root;
  const rows = [];
  let disc = null;
  for (const el of art.querySelectorAll("h3, table")) {
    if (el.tagName === "H3") {
      const key = clean(el.text).split(" ")[0].toLowerCase();
      disc = DISCIPLINES[key] ? key : null;
      continue;
    }
    if (!disc) continue;
    let level = null;
    for (const tr of el.querySelectorAll("tr")) {
      const cells = tr.childNodes.filter(n => n.tagName === "TD" || n.tagName === "TH");
      if (!cells.length || cells.some(c => /Power Name/i.test(c.text))) continue;
      let i = 0;
      if (/^\d+$/.test(clean(cells[0].text))) { level = Number(clean(cells[0].text)); i = 1; }
      const a = cells[i]?.querySelector("a");
      if (!clean(cells[i]?.text)) continue;
      rows.push({
        disc,
        level,
        name: clean(cells[i]?.text),
        href: (a?.getAttribute("href") ?? "").replace(/%20/g, ""),
        augment: clean(cells[i + 1]?.text) === "A",
        summary: clean(cells[i + 2]?.text),
        source: clean(cells[i + 3]?.text),
      });
    }
  }
  return rows;
}

/** Extrai os campos do bloco de estatísticas de uma página de poder. */
function parseStats(html) {
  // Quebra o HTML em linhas por <br>/</p> e remove as tags, depois lê "Campo valor".
  const text = html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;|&#160;/g, " ").replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—").replace(/&amp;/g, "&");
  const stats = {};
  for (const field of STAT_FIELDS) {
    // O rótulo e o valor precisam estar na mesma linha ("Range Long (...)").
    const re = new RegExp(`(?:^|\\n|;)[ \\t]*${field}[ \\t]*:?[ \\t]+([^;\\n]+)`, "i");
    const m = text.match(re);
    if (m && !stats[field]) stats[field] = clean(m[1]);
  }
  stats.Targets ??= stats.Target;
  stats._augment = /\n\s*Augment/i.test(text);
  return stats;
}

function parseActivation(txt = "") {
  const t = txt.toLowerCase();
  const n = Number(t.match(/(\d+)/)?.[1] ?? 1);
  const map = [["swift", "swift"], ["immediate", "immediate"], ["move", "move"], ["full-round", "full"], ["full round", "full"], ["standard", "standard"], ["free", "free"], ["minute", "minute"], ["hour", "hour"], ["round", "round"]];
  for (const [k, type] of map) if (t.includes(k)) return { type, cost: n, unchained: { type: "action", cost: type === "swift" ? 1 : 2 } };
  return { type: "special", cost: 1, unchained: { type: "action", cost: 2 } };
}

function parseRange(txt = "") {
  const t = txt.toLowerCase();
  for (const u of ["personal", "touch", "close", "medium", "long", "unlimited"]) if (t.startsWith(u)) return { units: u };
  const ft = t.match(/^(\d+)\s*ft\.?$/);
  if (ft) return { units: "ft", value: ft[1] };
  if (t.startsWith("see text")) return { units: "seeText" };
  return txt ? { units: "spec", value: txt } : { units: "" };
}

function parseDuration(txt = "") {
  const t = txt.toLowerCase();
  const base = { dismiss: /\(d\)/i.test(txt), concentration: t.startsWith("concentration") };
  if (t.startsWith("instantaneous")) return { units: "inst", ...base };
  if (t.startsWith("permanent")) return { units: "perm", ...base };
  return txt ? { units: "spec", value: txt, ...base } : { units: "" };
}

function parseSave(txt = "") {
  const t = txt.toLowerCase();
  if (!t || t.startsWith("none")) return null;
  const type = t.startsWith("fort") ? "fort" : t.startsWith("ref") ? "ref" : t.startsWith("will") ? "will" : "";
  return { type, description: txt };
}

/** "psychic warrior 1, egoist 1" → { class: {psychicWarrior:1, psion:1}, domain: {egoist:1} } */
function parseLearnedAt(txt = "", disc, fallbackLevel) {
  const learned = { class: {}, domain: {}, subDomain: {}, elementalSchool: {}, bloodline: {} };
  for (const part of txt.split(/[,;]/)) {
    const m = part.trim().toLowerCase().match(/^(.+?)\s+(\d)/);
    if (!m) continue;
    const lvl = Number(m[2]);
    for (const name of m[1].split("/").map(s => s.trim())) {
      if (DISCIPLINES[name]) { learned.domain[name] = lvl; learned.class.psion ??= lvl; }
      else if (CLASS_TAGS[name]) learned.class[CLASS_TAGS[name]] = lvl;
    }
  }
  // Sempre marca a especialização da lista e o psion, para o filtro de classe do navegador.
  learned.domain[disc] ??= fallbackLevel;
  learned.class.psion ??= fallbackLevel;
  return learned;
}

function buildItem(row, rawStats, folderId) {
  const d = DISCIPLINES[row.disc];
  const _id = id16(`power:${row.name}`);
  const expectedCost = Math.max(0, row.level * 2 - 1);
  let cost = Number.parseInt(rawStats["Power Points"] ?? "", 10);
  // Variantes (", Greater", ", Minor"...) costumam apontar para a página do poder base.
  // Custo diferente de 2×nível−1 indica que o bloco lido é de outro poder: guarda só o que é comum.
  const sharedPage = Number.isFinite(cost) && cost !== expectedCost;
  const stats = sharedPage
    ? { Discipline: rawStats.Discipline, Display: rawStats.Display, _augment: rawStats._augment }
    : rawStats;
  if (!Number.isFinite(cost) || sharedPage) cost = expectedCost;
  const save = parseSave(stats["Saving Throw"]);
  const descriptors = [...(stats.Discipline ?? "").matchAll(/\[([^\]]+)\]/g)]
    .flatMap(m => m[1].split(/[,;]/)).map(s => clean(s).toLowerCase())
    .filter(s => s && s !== "see text")
    // Mesmas chaves do PF1: "mind-affecting" → "mindAffecting".
    .map(s => s.replace(/[-\s]+([a-z])/g, (_, c) => c.toUpperCase()));
  const display = stats.Display ? stats.Display.replace(/\b\w/g, c => c.toUpperCase()) : "";
  const sourceLabel = SOURCES[row.source] ?? row.source;

  const action = {
    _id: id16(`action:${row.name}`),
    name: "Manifest",
    actionType: save ? "spellsave" : "other",
    activation: parseActivation(stats["Manifesting Time"]),
    range: parseRange(stats.Range),
    duration: parseDuration(stats.Duration),
  };
  if (stats.Targets) action.target = { value: stats.Targets };
  if (stats.Area) action.area = stats.Area;
  if (stats.Effect) action.effect = stats.Effect;
  if (save) action.save = save;

  const description = [
    `<p><em>${escapeHtml(row.summary)}</em></p>`,
    row.augment || stats._augment ? `<p><strong>Augment:</strong> this power can be augmented (see full text).</p>` : "",
    sharedPage || !rawStats.Range ? `<p><strong>Note:</strong> range, duration and saving throw were not imported for this power; check the full text.</p>` : "",
    row.href ? `<p>Full text: <a href="${row.href}">${escapeHtml(row.name)} on d20pfsrd.com</a></p>` : "",
    `<p><strong>Source:</strong> ${escapeHtml(sourceLabel)}</p>`,
  ].join("");

  return {
    _id,
    _key: `!items!${_id}`,
    name: row.name,
    type: "spell",
    img: d.img,
    folder: folderId,
    sort: 0,
    system: {
      description: { value: description, instructions: "" },
      tags: [],
      actions: [action],
      learnedAt: parseLearnedAt(stats.Level, row.disc, row.level),
      level: row.level,
      school: d.school,
      subschool: [],
      descriptors,
      components: { value: display, verbal: false, somatic: false, thought: false, emotion: false, material: false, focus: false, divineFocus: 0 },
      materials: { value: "", focus: "", gpValue: 0 },
      spellbook: "psionic",
      preparation: { value: 1, max: 1 },
      atWill: false,
      sr: /^yes/i.test(stats["Power Resistance"] ?? ""),
      domain: false,
      slotCost: 1,
      spellPoints: { cost: String(cost) },
    },
    effects: [],
    flags: {
      "pf1-psionics": {
        power: true,
        discipline: d.school,
        specialization: row.disc,
        augment: row.augment || stats._augment,
        display,
        powerPoints: cost,
        source: sourceLabel,
        url: row.href,
      },
    },
  };
}

function buildFolder(key, sort) {
  const d = DISCIPLINES[key];
  const _id = id16(`folder:${key}`);
  return { _id, _key: `!folders!${_id}`, name: d.folder, type: "Item", folder: null, sorting: "a", sort, color: null, description: "", flags: {} };
}

async function main() {
  const list = await get(LIST_URL);
  if (list.status !== 200) throw new Error(`List page returned ${list.status}`);
  const rows = parseList(list.html);
  console.log(`Found ${rows.length} powers on the list page.`);

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const folders = {};
  Object.keys(DISCIPLINES).forEach((key, i) => {
    folders[key] = buildFolder(key, (i + 1) * 100000);
    fs.writeFileSync(path.join(OUT_DIR, `_folder-${key}.json`), JSON.stringify(folders[key], null, 2));
  });

  const missing = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.name)) continue; // um poder pode aparecer em mais de uma lista
    seen.add(row.name);
    let stats = {};
    if (row.href) {
      const page = await get(row.href);
      if (page.status === 200) stats = parseStats(page.html);
      else missing.push(`${row.name} (${page.status})`);
      await sleep(DELAY_MS);
    }
    const item = buildItem(row, stats, folders[row.disc]._id);
    fs.writeFileSync(path.join(OUT_DIR, `${row.disc}-${slug(row.name)}.json`), JSON.stringify(item, null, 2));
  }
  console.log(`Wrote ${seen.size} powers to ${OUT_DIR}`);
  if (missing.length) console.log(`Pages not found (built from list data only): ${missing.join(", ")}`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("scrape-powers.mjs")) {
  main().catch(err => { console.error(err); process.exit(1); });
}
