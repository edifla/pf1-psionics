// Exploratory: prints the key stats of each psionic class page so the class data can be authored.
import { parse } from "node-html-parser";

const BASE = "https://www.d20pfsrd.com/alternative-rule-systems/3rd-party-rules-systems/psionics-unleashed/classes/";
const CLASSES = ["psion", "psychic-warrior", "wilder", "soulknife", "aegis", "cryptic", "dread", "marksman", "tactician", "vitalist", "voyager"];

const clean = s => s.replace(/\s+/g, " ").trim();

for (const slug of CLASSES) {
  const res = await fetch(BASE + slug + "/", { headers: { "user-agent": "Mozilla/5.0" } });
  const root = parse(await res.text());
  const art = root.querySelector("article") ?? root;
  const text = clean(art.text);
  const grab = (re) => (text.match(re)?.[1] ?? "?").slice(0, 400);
  console.log(`\n### ${slug} (${res.status})`);
  console.log("Alignment:", grab(/Alignment:?\s*(.*?)(Hit Die|Starting Wealth)/i));
  console.log("HitDie:", grab(/Hit Die:?\s*(d\d+)/i));
  console.log("Wealth:", grab(/Starting Wealth:?\s*(.*?gp)/i));
  console.log("Skills:", grab(/Class Skills\s*(.*?)Skill Ranks/i));
  console.log("Ranks:", grab(/Skill Ranks per Level:?\s*(.*?modifier)/i));
  const table = art.querySelector("table");
  if (table) {
    const rows = table.querySelectorAll("tr").map(tr => tr.querySelectorAll("th,td").map(c => clean(c.text)));
    console.log("Header:", JSON.stringify(rows[0]), JSON.stringify(rows[1]));
    for (const r of rows.slice(1, 4)) console.log("Row:", JSON.stringify(r));
    console.log("Row20:", JSON.stringify(rows[rows.length - 1]));
  }
}
