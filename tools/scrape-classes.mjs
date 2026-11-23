/**
 * Gera packs-src/classes com as classes base psiônicas do d20pfsrd (Psionics Unleashed / Expanded).
 *
 * Cada classe vira um Item "class" do PF1 (DV, BBA, resistências, perícias de classe, riqueza),
 * com a tabela de pontos de poder, poderes conhecidos e nível máximo guardada em flags do módulo.
 * Classes com poderes ligam automaticamente o grimório psiônico ao serem adicionadas à ficha.
 *
 * Uso: node tools/scrape-classes.mjs [--dry]
 */
import { parse } from "node-html-parser";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.d20pfsrd.com/alternative-rule-systems/3rd-party-rules-systems/psionics-unleashed/classes/";
const CLASSES = {
  psion: { name: "Psion", img: "icons/magic/perception/eye-winged-pink.webp" },
  "psychic-warrior": { name: "Psychic Warrior", img: "icons/magic/control/buff-flight-wings-runes-purple.webp" },
  wilder: { name: "Wilder", img: "icons/magic/fire/beam-jet-stream-blue.webp" },
  soulknife: { name: "Soulknife", img: "icons/magic/light/beam-rays-blue.webp" },
  aegis: { name: "Aegis", img: "icons/magic/defensive/shield-barrier-blue.webp" },
  cryptic: { name: "Cryptic", img: "icons/magic/symbols/circle-ouroboros.webp" },
  dread: { name: "Dread", img: "icons/magic/unholy/energy-smoke-pink.webp" },
  marksman: { name: "Marksman", img: "icons/magic/perception/eye-slit-orange.webp" },
  tactician: { name: "Tactician", img: "icons/magic/symbols/cog-shield-white-blue.webp" },
  vitalist: { name: "Vitalist", img: "icons/magic/life/cross-beam-green.webp" },
  voyager: { name: "Voyager", img: "icons/magic/movement/trail-streak-zigzag-teal.webp" },
};
const OUT_DIR = path.resolve("packs-src/classes");
const DRY = process.argv.includes("--dry");

const SKILLS = {
  acrobatics: "acr", appraise: "apr", artistry: "art", bluff: "blf", climb: "clm", craft: "crf",
  diplomacy: "dip", "disable device": "dev", disguise: "dis", "escape artist": "esc", fly: "fly",
  "handle animal": "han", heal: "hea", intimidate: "int", "knowledge (arcana)": "kar",
  "knowledge (dungeoneering)": "kdu", "knowledge (engineering)": "ken", "knowledge (geography)": "kge",
  "knowledge (history)": "khi", "knowledge (local)": "klo", "knowledge (nature)": "kna",
  "knowledge (nobility)": "kno", "knowledge (planes)": "kpl", "knowledge (religion)": "kre",
  linguistics: "lin", lore: "lor", perception: "per", perform: "prf", profession: "pro", ride: "rid",
  "sense motive": "sen", "sleight of hand": "slt", spellcraft: "spl", stealth: "ste", survival: "sur",
  swim: "swm", "use magic device": "umd",
};
const ALL_KNOWLEDGE = ["kar", "kdu", "ken", "kge", "khi", "klo", "kna", "kno", "kpl", "kre"];
const ABILITY = { intelligence: "int", wisdom: "wis", charisma: "cha" };

const clean = s => (s ?? "").replace(/ /g, " ").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
const id16 = seed => createHash("sha1").update(seed).digest("hex").slice(0, 16);
const camel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
// Primeiro número da célula: "+10/+5" → 10, "1st" → 1, "—" → 0.
const num = s => Number.parseInt(String(s ?? "").match(/-?\d+/)?.[0] ?? "0", 10);
const escapeHtml = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function parseSkills(text) {
  const m = text.match(/class skills(?:\s*\([^)]*\))?\s+are\s*:?\s*(.+?)(?:\.\s|\s*Skill Ranks)/i)
    ?? text.match(/Class Skills\s*:\s*(.+?)(?:\.\s|\s*Skill Ranks)/i);
  const skills = {};
  const unmapped = [];
  if (!m) return { skills, unmapped, raw: "" };
  for (let part of m[1].replace(/\band\b/g, ",").split(",")) {
    part = clean(part).replace(/\s*\((str|dex|con|int|wis|cha)\)\s*$/i, "").toLowerCase();
    if (!part) continue;
    if (/^knowledge \((all|any)/.test(part)) { ALL_KNOWLEDGE.forEach(k => (skills[k] = true)); continue; }
    if (SKILLS[part]) skills[SKILLS[part]] = true;
    else unmapped.push(part.replace(/\b\w/g, c => c.toUpperCase()));
  }
  return { skills, unmapped, raw: m[1] };
}

function parseKeyAbility(text) {
  const patterns = [
    /(?:manifest|power)[^.]{0,160}?\b(Intelligence|Wisdom|Charisma)\b/i,
    /\b(Intelligence|Wisdom|Charisma)\b[^.]{0,120}?(?:manifest|power points)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return ABILITY[m[1].toLowerCase()];
  }
  return null;
}

function parseTable(html) {
  // Recorta cada <table>…</table> do HTML bruto: algumas páginas têm marcação quebrada
  // e o parser aninha a tabela de progressão em lugares estranhos.
  const table = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)]
    .map(m => parse(m[0]).querySelector("table"))
    .find(t => t && /Fort/i.test(t.text) && /Level/i.test(t.text));
  if (!table) return null;
  const rows = table.querySelectorAll("tr").map(tr => tr.querySelectorAll("th,td").map(c => clean(c.text)));
  const header = rows.find(r => r.some(c => /Fort/i.test(c)));
  const body = rows.filter(r => /^\d+(st|nd|rd|th)?$/.test(r[0]));
  const trs = table.querySelectorAll("tr").filter(tr => /^\d+(st|nd|rd|th)?$/.test(clean(tr.querySelectorAll("th,td")[0]?.text)));
  const col = re => header.findIndex(c => re.test(c));
  return {
    header,
    rows: body,
    trs,
    idx: {
      bab: col(/Base Attack|BAB/i), fort: col(/Fort/i), ref: col(/Ref/i), will: col(/Will/i),
      special: col(/Special/i), pp: col(/Power Points/i), known: col(/Powers Known/i),
      max: col(/Maximum (Power|Design) Level/i),
    },
  };
}

const SMALL_WORDS = new Set(["of", "the", "and", "in", "a", "an", "to", "on", "for"]);
const titleCase = s => s.split(" ").map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
const ABILITY_TYPES = { su: "su", ex: "ex", sp: "sp", ps: "sp" }; // Ps (psi-like) ≈ Sp no PF1
const FEATURES_PACK = "Compendium.pf1-psionics.psionic-class-features.Item";

/**
 * Lê as habilidades da coluna "Special": cada link #TOC-... é uma habilidade, ganha no primeiro
 * nível em que aparece (repetições seguintes são a progressão da mesma habilidade).
 */
function parseFeatures(table, className, classImg, url) {
  if (table.idx.special < 0) return [];
  const seen = new Map();
  for (const tr of table.trs) {
    const cells = tr.querySelectorAll("th,td");
    const level = num(cells[0]?.text);
    const cell = cells[table.idx.special];
    if (!cell || !level) continue;
    const links = cell.querySelectorAll("a");
    if (!links.length) {
      // Tabela sem links (ex.: Voyager): usa o texto, sem os valores de progressão.
      for (let part of clean(cell.text).split(",")) {
        part = part.replace(/\([^)]*\)/g, "").replace(/\s*[+–-]?\d.*$/, "").trim();
        if (!part || part === "—" || seen.has(part.toLowerCase())) continue;
        seen.set(part.toLowerCase(), { anchor: "", name: titleCase(part), level, abilityType: "na" });
      }
      continue;
    }
    for (const a of links) {
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("#")) continue;
      const anchor = href.slice(1);
      const label = clean(a.text);
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      const suffix = anchor.match(/-(Su|Ex|Sp|Ps)-?$/i)?.[1]?.toLowerCase();
      const name = titleCase(label) + (suffix ? ` (${suffix.charAt(0).toUpperCase()}${suffix.slice(1)})` : "");
      seen.set(key, { anchor, name, level, abilityType: ABILITY_TYPES[suffix] ?? "na" });
    }
  }
  return [...seen.values()].map(f => {
    const _id = id16(`feature:${className}:${f.name}`);
    return {
      _id,
      _key: `!items!${_id}`,
      name: f.name,
      type: "feat",
      img: classImg,
      sort: f.level * 1000,
      system: {
        description: {
          value: `<p>${escapeHtml(className)} class feature, gained at level ${f.level}.</p><p>Full text: <a href="${url}#${f.anchor}">${escapeHtml(f.name)} on d20pfsrd.com</a></p>`,
          instructions: "",
        },
        tags: ["Psionic"],
        subType: "classFeat",
        abilityType: f.abilityType,
        associations: { classes: [className] },
      },
      effects: [],
      flags: { "pf1-psionics": { classFeature: true, class: className, level: f.level } },
      _level: f.level,
    };
  });
}

const progression = last => (last >= 20 ? "high" : last >= 15 ? "med" : "low");
const saveType = last => (last >= 12 ? "high" : "low");

function buildClass(slug, meta, html) {
  const root = parse(html);
  const art = root.querySelector("article") ?? root;
  const text = clean(art.text);
  const table = parseTable(html);
  if (!table) throw new Error(`No progression table for ${slug}`);
  const { rows, idx } = table;
  const last = rows[rows.length - 1];
  const hd = num(text.match(/Hit Die:?\s*d(\d+)/i)?.[1] ?? 8);
  const ranks = num(text.match(/Skill Ranks (?:per|at each) Level:?\s*(\d+)/i)?.[1] ?? 2);
  const wealth = (text.match(/Starting Wealth:?\s*(\d+d\d+\s*[×x*]\s*10)/i)?.[1] ?? "").replace(/\s*[×x]\s*/, " * ");
  const { skills, unmapped } = parseSkills(text);
  const ppTable = idx.pp >= 0 ? rows.map(r => num(r[idx.pp])) : [];
  const knownTable = idx.known >= 0 ? rows.map(r => num(r[idx.known])) : [];
  const maxLevelTable = idx.max >= 0 ? rows.map(r => num(r[idx.max])) : [];
  const hasPowers = knownTable.some(n => n > 0) && ppTable.some(n => n > 0);
  const maxLevel = Math.max(0, ...maxLevelTable);
  const keyAbility = hasPowers ? parseKeyAbility(text) : null;
  const tag = camel(slug);
  const _id = id16(`class:${slug}`);
  const url = `${BASE}${slug}/`;

  const features = parseFeatures(table, meta.name, meta.img, url);

  // Cabeçalhos curtos para a tabela caber na ficha da classe.
  const headCells = ["Lvl", "BAB", "Fort", "Ref", "Will", "Special"];
  if (ppTable.length) headCells.push("PP");
  if (knownTable.length) headCells.push("Known", "Max");
  const bodyRows = rows.map(r => {
    const cells = [r[0], r[idx.bab], r[idx.fort], r[idx.ref], r[idx.will], idx.special >= 0 ? r[idx.special] : ""];
    if (ppTable.length) cells.push(r[idx.pp]);
    if (knownTable.length) cells.push(r[idx.known], idx.max >= 0 ? r[idx.max] : "");
    return `<tr>${cells.map(c => `<td>${escapeHtml(c ?? "")}</td>`).join("")}</tr>`;
  });
  const description = [
    `<p><strong>${meta.name}</strong> — psionic base class (Dreamscarred Press).</p>`,
    hasPowers ? `<p><strong>Manifesting:</strong> key ability ${keyAbility?.toUpperCase() ?? "?"}, powers up to level ${maxLevel}. Adding this class to a character enables the Psionic powers book.</p>` : "",
    unmapped.length ? `<p><strong>Psionic skills not in PF1:</strong> ${escapeHtml(unmapped.join(", "))}.</p>` : "",
    `<table class="pf1-psionics-progression"><thead><tr>${headCells.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${bodyRows.join("")}</tbody></table>`,
    `<p>Class features: <a href="${url}">${meta.name} on d20pfsrd.com</a></p>`,
  ].join("");

  const item = {
    _id,
    _key: `!items!${_id}`,
    name: meta.name,
    type: "class",
    img: meta.img,
    folder: null,
    sort: 0,
    system: {
      description: { value: description, instructions: "" },
      tags: ["Psionic"],
      changes: [],
      contextNotes: [],
      // O PF1 adiciona estas habilidades à ficha quando a classe atinge o nível indicado.
      links: {
        children: [],
        classAssociations: features.map(f => ({ level: f._level, uuid: `${FEATURES_PACK}.${f._id}` })),
        supplements: [],
      },
      tag,
      armorProf: [],
      weaponProf: [],
      languages: [],
      subType: "base",
      level: 1,
      hd,
      hp: hd,
      bab: progression(num(last[idx.bab])),
      skillsPerLevel: ranks,
      savingThrows: {
        fort: { value: saveType(num(last[idx.fort])) },
        ref: { value: saveType(num(last[idx.ref])) },
        will: { value: saveType(num(last[idx.will])) },
      },
      wealth,
      classSkills: skills,
    },
    effects: [],
    flags: {
      "pf1-psionics": {
        psionic: hasPowers,
        keyAbility,
        maxPowerLevel: maxLevel,
        casterType: maxLevel >= 9 ? "high" : maxLevel >= 6 ? "med" : "low",
        ppTable,
        powersKnown: knownTable,
        maxPowerLevelTable: maxLevelTable,
        unmappedSkills: unmapped,
        url,
      },
    },
  };
  return { item, features };
}

const FEATURES_DIR = path.resolve("packs-src/class-features");

async function main() {
  if (!DRY) {
    for (const dir of [OUT_DIR, FEATURES_DIR]) {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  let sort = 0;
  for (const [slug, meta] of Object.entries(CLASSES)) {
    const res = await fetch(`${BASE}${slug}/`, { headers: { "user-agent": "Mozilla/5.0 (pf1-psionics builder)" } });
    if (!res.ok) { console.warn(`${slug}: HTTP ${res.status}`); continue; }
    const { item, features } = buildClass(slug, meta, await res.text());
    const f = item.flags["pf1-psionics"];
    const s = item.system;
    console.log(`${meta.name}: d${s.hd} bab=${s.bab} F/R/W=${s.savingThrows.fort.value}/${s.savingThrows.ref.value}/${s.savingThrows.will.value} ranks=${s.skillsPerLevel} powers=${f.psionic} key=${f.keyAbility} max=${f.maxPowerLevel} features=${features.length}: ${features.map(x => `${x._level}:${x.name}`).join(", ")}`);
    if (!DRY) {
      fs.writeFileSync(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(item, null, 2));
      // Uma pasta por classe no compêndio de habilidades.
      const folderId = id16(`feature-folder:${slug}`);
      const folder = { _id: folderId, _key: `!folders!${folderId}`, name: meta.name, type: "Item", folder: null, sorting: "m", sort: (sort += 100000), color: null, description: "", flags: {} };
      fs.writeFileSync(path.join(FEATURES_DIR, `_folder-${slug}.json`), JSON.stringify(folder, null, 2));
      for (const feat of features) {
        const { _level, ...data } = feat;
        data.folder = folderId;
        const file = `${slug}-${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}.json`;
        fs.writeFileSync(path.join(FEATURES_DIR, file), JSON.stringify(data, null, 2));
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
