/**
 * Gera packs-src/buffs: buffs e debuffs do PF1 para os poderes psiônicos.
 *
 * Os efeitos foram escritos à mão a partir do texto de cada poder (ver tabela abaixo).
 * Ícone, nível e link vêm do item do poder em packs-src/powers. "@item.level" é o nível do buff,
 * que o PF1 preenche com o nível de manifestador quando o buff é aplicado.
 *
 * Uso: node tools/build-buffs.mjs   (rode depois de scrape-powers)
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const POWERS_DIR = path.resolve("packs-src/powers");
const OUT_DIR = path.resolve("packs-src/buffs");

const id16 = seed => createHash("sha1").update(seed).digest("hex").slice(0, 16);
const id8 = seed => createHash("sha1").update(seed).digest("hex").slice(0, 8);

const MIN = (value = "@item.level") => ({ value, units: "minute", end: "turnStart" });
const RND = (value = "@item.level") => ({ value, units: "round", end: "turnStart" });
const HOUR = (value = "@item.level") => ({ value, units: "hour", end: "turnStart" });
const OPEN = () => ({ value: "", units: "", end: "turnStart" });

const ABILITIES = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };

/**
 * name: nome do buff · power: poder de origem · kind: buff|debuff
 * changes: [target, type, formula] · conditions: ids do PF1 · notes: [target, text] · text: descrição curta
 */
const BUFFS = [
  ...Object.entries(ABILITIES).map(([key, label]) => ({
    name: `Animal Affinity (${label})`, power: "Animal Affinity", kind: "buff", duration: MIN(),
    changes: [[key, "enh", "4"]],
    text: `+4 enhancement bonus to ${label}. Augment: +4 to another ability per 5 extra PP (apply another Animal Affinity buff).`,
  })),
  {
    name: "Chameleon", power: "Chameleon", kind: "buff", duration: MIN("@item.level * 10"),
    changes: [["skill.ste", "enh", "10"]],
    text: "+10 enhancement bonus on Stealth checks. Augment: +1 per 2 extra PP (edit the change formula).",
  },
  {
    name: "Thicken Skin", power: "Thicken Skin", kind: "buff", duration: MIN("@item.level * 10"),
    changes: [["nac", "enh", "1"]],
    text: "+1 enhancement bonus to natural armor. Augment: +1 per 3 extra PP (edit the change formula).",
  },
  {
    name: "Physical Acceleration", power: "Physical Acceleration", kind: "buff", duration: RND(),
    changes: [["attack", "untyped", "1"], ["ac", "dodge", "1"], ["ref", "dodge", "1"], ["allSpeeds", "enh", "30"]],
    notes: [["attack", "Physical Acceleration: one extra attack at full BAB when making a full attack."]],
    text: "+1 on attack rolls, +1 dodge bonus to AC and Reflex saves, +30 ft. to all movement modes, and one extra attack on a full attack.",
  },
  {
    name: "Burst", power: "Burst", kind: "buff", duration: RND("1"),
    changes: [["landSpeed", "enh", "10"]],
    text: "+10 ft. enhancement bonus to land speed. Augment: +10 ft. per 4 extra PP (edit the change formula).",
  },
  {
    name: "Flight", power: "Flight", kind: "buff", duration: MIN(),
    changes: [["flySpeed", "untyped", "60"], ["skill.fly", "untyped", "floor(@item.level / 2)"]],
    text: "Fly speed 60 ft. (good maneuverability; 40 ft. in medium/heavy armor or load). Bonus on Fly checks equal to half the manifester level.",
  },
  {
    name: "Inertial Barrier", power: "Inertial Barrier", kind: "buff", duration: MIN("@item.level * 10"),
    notes: [["ac", "Inertial Barrier: DR 5/–; half damage from falls."]],
    text: "Damage reduction 5/– and half damage from falling. Add the DR in the actor's defenses while active.",
  },
  {
    name: "Ectoplasmic Form", power: "Ectoplasmic Form", kind: "buff", duration: MIN(),
    changes: [["flySpeed", "untyped", "20"]],
    notes: [["ac", "Ectoplasmic Form: DR 10/psionics; immune to poison and critical hits; material armor doesn't apply."]],
    text: "DR 10/psionics, immunity to poison and critical hits, fly 20 ft. (perfect). Material armor stops counting; you can't attack physically or speak, and manifesting needs a concentration check (DC 20 + power level).",
  },
  {
    name: "Resist Toxin", power: "Resist Toxin", kind: "buff", duration: HOUR(),
    notes: [["allSavingThrows", "Resist Toxin: immune to poison."]],
    text: "Temporarily immune to poison; poisons already in your system are suspended until the power ends.",
  },
  {
    name: "Precognition", power: "Precognition", kind: "buff", duration: MIN("@item.level * 10"),
    notes: [["attack", "Precognitive edge: +[[2]] insight to one roll (then end the buff)."], ["allSavingThrows", "Precognitive edge: +[[2]] insight to one roll (then end the buff)."], ["skills", "Precognitive edge: +[[2]] insight to one roll (then end the buff)."]],
    text: "Precognitive edge: +2 insight bonus to one attack roll, damage roll, saving throw or skill check, used before the roll. Ends when used.",
  },
  {
    name: "Precognition, Greater", power: "Precognition, Greater", kind: "buff", duration: MIN("@item.level * 10"),
    notes: [["attack", "Greater precognitive edge: +[[4]] insight to one roll (then end the buff)."], ["allSavingThrows", "Greater precognitive edge: +[[4]] insight to one roll (then end the buff)."], ["skills", "Greater precognitive edge: +[[4]] insight to one roll (then end the buff)."]],
    text: "Greater precognitive edge: +4 insight bonus to one roll. Ends when used.",
  },
  {
    name: "Battlesense (Attack)", power: "Battlesense", kind: "buff", duration: RND(),
    changes: [["attack", "circumstance", "1"]],
    text: "Collective members gain +1 circumstance bonus to attack rolls. All targets can Aid Another as an immediate action.",
  },
  {
    name: "Battlesense (AC)", power: "Battlesense", kind: "buff", duration: RND(),
    changes: [["ac", "circumstance", "1"]],
    text: "Collective members gain +1 circumstance bonus to AC. All targets can Aid Another as an immediate action.",
  },
  {
    name: "Battlesense (Damage)", power: "Battlesense", kind: "buff", duration: RND(),
    changes: [["wdamage", "circumstance", "2"]],
    text: "Collective members gain +2 circumstance bonus to weapon damage. All targets can Aid Another as an immediate action.",
  },
  {
    name: "Battlesense (Speed)", power: "Battlesense", kind: "buff", duration: RND(),
    changes: [["landSpeed", "circumstance", "5"]],
    text: "Collective members gain +5 ft. circumstance bonus to base speed. All targets can Aid Another as an immediate action.",
  },

  // ---------------------------------------------------------------- debuffs
  {
    name: "Destiny Dissonance", power: "Destiny Dissonance", kind: "debuff", duration: RND(),
    conditions: ["sickened"],
    text: "Sickened for 1 round per manifester level (melee touch attack).",
  },
  {
    name: "Expose Weakness", power: "Expose Weakness", kind: "debuff", duration: RND(),
    notes: [["ac", "Expose Weakness: treated as flanked by all attackers; attackers get +4 to confirm criticals; fortification is rolled twice (worse result)."]],
    text: "The target is treated as flanked by all attackers, attacks against it gain +4 to confirm critical hits, and fortification is rolled twice using the worse result.",
  },
  {
    name: "Expose Weakness (Augmented)", power: "Expose Weakness", kind: "debuff", duration: RND(),
    conditions: ["flatFooted"],
    notes: [["ac", "Expose Weakness: attackers get +4 to confirm criticals; fortification is rolled twice (worse result)."]],
    text: "Augmented (+6 PP): the target is flat-footed instead of flanked, plus the other effects of Expose Weakness.",
  },
  {
    name: "Gravitational Well", power: "Gravitational Well", kind: "debuff", duration: RND(),
    changes: [["ac", "untyped", "-2"]],
    text: "Attacks against the target gain +2 (modeled as −2 AC). Attacks against other creatures within 10 ft. take −2, and moving away from the target is difficult terrain.",
  },
  {
    name: "Brain Lock", power: "Brain Lock", kind: "debuff", duration: OPEN(),
    conditions: ["dazed"],
    text: "Dazed while the manifester concentrates, +1 round. The subject can spend a full-round action each turn to attempt a new save.",
  },
  {
    name: "True Terror", power: "True Terror", kind: "debuff", duration: RND("1"),
    conditions: ["stunned"],
    text: "Stunned for 1 round.",
  },
  {
    name: "Fear Cascade (Cowering)", power: "Fear Cascade", kind: "debuff", duration: RND(),
    conditions: ["cowering"],
    text: "The target is cowering (Will negates).",
  },
  {
    name: "Fear Cascade (Shaken)", power: "Fear Cascade", kind: "debuff", duration: RND("1"),
    conditions: ["shaken"],
    text: "The target and all enemies within 20 ft. are shaken for 1 round. Augment: +1 round per 2 extra PP.",
  },
  {
    name: "Sensory Cascade", power: "Sensory Cascade", kind: "debuff", duration: OPEN(),
    conditions: ["dazed"],
    text: "A cascade of the senses leaves the target dazed. Check the full text for the duration.",
  },
  {
    name: "Ectoplasmic Cocoon", power: "Ectoplasmic Cocoon", kind: "debuff", duration: RND(),
    conditions: ["helpless"],
    text: "Wrapped in ectoplasm: helpless, can't see out, speak or take physical actions (mental actions allowed). The cocoon has hardness 8 and 20 hp.",
  },
  {
    name: "Crystalline Bonds", power: "Crystalline Bonds", kind: "debuff", duration: RND(),
    notes: [["skills", "Crystalline Bonds: break free with a DC 20 Strength or Escape Artist check (1 round)."]],
    text: "Bound and gagged by crystal: 3d6 damage, then 1d6 per round. Only mental actions; manifesting needs a concentration check (DC 20 + half the continuous damage). Break free with DC 20 Strength or Escape Artist (1 round). The crystal has AC 5, hardness 12, 30 hp.",
  },
];

function loadPowers() {
  const byName = new Map();
  for (const f of fs.readdirSync(POWERS_DIR)) {
    if (f.startsWith("_")) continue;
    const p = JSON.parse(fs.readFileSync(path.join(POWERS_DIR, f), "utf8"));
    byName.set(p.name, p);
  }
  return byName;
}

function folder(key, name, sort) {
  const _id = id16(`buff-folder:${key}`);
  return { _id, _key: `!folders!${_id}`, name, type: "Item", folder: null, sorting: "a", sort, color: null, description: "", flags: {} };
}

function main() {
  const powers = loadPowers();
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const folders = { buff: folder("buff", "Buffs", 100000), debuff: folder("debuff", "Debuffs", 200000) };
  for (const [k, f] of Object.entries(folders)) fs.writeFileSync(path.join(OUT_DIR, `_folder-${k}.json`), JSON.stringify(f, null, 2));

  const missing = [];
  for (const b of BUFFS) {
    const power = powers.get(b.power);
    if (!power) missing.push(b.power);
    const pf = power?.flags?.["pf1-psionics"] ?? {};
    const _id = id16(`buff:${b.name}`);
    const link = power ? `<p>Power: @UUID[Compendium.pf1-psionics.psionic-powers.Item.${power._id}]{${b.power}}${pf.url ? ` · <a href="${pf.url}">full text</a>` : ""}</p>` : "";
    const item = {
      _id,
      _key: `!items!${_id}`,
      name: b.name,
      type: "buff",
      img: power?.img ?? "icons/svg/aura.svg",
      folder: folders[b.kind]._id,
      sort: 0,
      system: {
        description: { value: `<p>${b.text}</p>${link}`, instructions: "" },
        tags: ["Psionic"],
        changes: (b.changes ?? []).map(([target, type, formula], i) => ({ _id: id8(`${b.name}:${i}`), formula, target, type })),
        contextNotes: (b.notes ?? []).map(([target, text]) => ({ target, text })),
        subType: "spell",
        active: false,
        level: power?.system?.level ?? 1,
        duration: b.duration,
        conditions: b.conditions ?? [],
        hideFromToken: false,
      },
      effects: [],
      flags: { "pf1-psionics": { buff: true, power: b.power, kind: b.kind } },
    };
    fs.writeFileSync(path.join(OUT_DIR, `${b.kind}-${b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}.json`), JSON.stringify(item, null, 2));
  }
  console.log(`Wrote ${BUFFS.length} buffs/debuffs to ${OUT_DIR}`);
  if (missing.length) console.warn(`Power not found for: ${[...new Set(missing)].join(", ")}`);
}

main();
