/**
 * PF1 Psionics — suporte a poderes psiônicos para o sistema Pathfinder 1e (PF1 11.x, Foundry v13).
 *
 * Desenho:
 *  - Os poderes são Items "spell" do PF1 num grimório extra, "psionic". Assim usam a ficha de
 *    magia, as ações, os cartões de chat, o NC e a CD do próprio sistema.
 *  - Os pontos de poder usam o sistema de "spell points" do PF1 nesse grimório. O máximo vem de
 *    @psionics.pp, calculado a partir da tabela de PP das classes psiônicas + bônus de atributo.
 *  - O grimório aparece em Configurações → Uso de grimórios (como os outros) e também é ligado
 *    automaticamente ao adicionar uma classe psiônica.
 *  - Na ficha, o grimório psiônico sai da aba Magias e vai para uma aba própria, "Poderes".
 *  - O botão de procurar abre um navegador de compêndio só de poderes, com filtros de disciplina,
 *    nível, classe e especialização.
 */

export const MODULE_ID = "pf1-psionics";
export const BOOK = "psionic";
const BOOK_PATH = `system.attributes.spells.spellbooks.${BOOK}`;
const TAB = BOOK; // mesma chave: o PF1 usa a aba mais próxima para descobrir o grimório

export const DISCIPLINES = {
  clairsentience: "PSIONICS.Discipline.clairsentience",
  metacreativity: "PSIONICS.Discipline.metacreativity",
  psychokinesis: "PSIONICS.Discipline.psychokinesis",
  psychometabolism: "PSIONICS.Discipline.psychometabolism",
  psychoportation: "PSIONICS.Discipline.psychoportation",
  telepathy: "PSIONICS.Discipline.telepathy",
};

export const SPECIALIZATIONS = {
  seer: "PSIONICS.Specialization.seer",
  shaper: "PSIONICS.Specialization.shaper",
  kineticist: "PSIONICS.Specialization.kineticist",
  egoist: "PSIONICS.Specialization.egoist",
  nomad: "PSIONICS.Specialization.nomad",
  telepath: "PSIONICS.Specialization.telepath",
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const localize = key => game.i18n.localize(key);

export function getBook(actor) {
  return actor?.system?.attributes?.spells?.spellbooks?.[BOOK];
}

export function isPowerPack(pack) {
  const meta = pack?.metadata ?? {};
  return !!meta.flags?.[MODULE_ID]?.powers
    || (meta.packageName === MODULE_ID && meta.name === "psionic-powers");
}

function isPower(item) {
  return item?.type === "spell" && (item.flags?.[MODULE_ID]?.power || item.system?.spellbook === BOOK);
}

/** Valores padrão do grimório psiônico (mesmo formato dos grimórios do template.json do PF1). */
function bookDefaults() {
  const spells = {};
  for (let i = 0; i <= 9; i++) spells[`spell${i}`] = { castPerDayOffsetFormula: "", preparedOffsetFormula: "" };
  return {
    name: "",
    inUse: false,
    castPerDayAllOffsetFormula: "",
    preparedAllOffsetFormula: "",
    casterType: "high",
    class: "",
    cl: { formula: "" },
    concentrationFormula: "",
    concentrationNotes: "",
    clNotes: "",
    ability: "int",
    autoSpellLevelCalculation: false,
    autoSpellLevels: false,
    psychic: false,
    arcaneSpellFailure: false,
    hasCantrips: false,
    spellPreparationMode: "spontaneous",
    kind: "psionic",
    baseDCFormula: "10 + @sl + @ablMod",
    spellPoints: { useSystem: true, value: 0, maxFormula: "@psionics.pp", restoreFormula: "" },
    spells,
    spellSlotAbilityBonusFormula: "",
    domainSlotValue: 0,
  };
}

/* -------------------------------------------------------------------------- */
/*  init: dados e configuração                                                */
/* -------------------------------------------------------------------------- */

function registerBookDefaults() {
  // game.model é congelado só no primeiro nível; os templates dos tipos podem receber chaves.
  // O Foundry mescla esse template nos dados de todos os atores ao carregar o mundo.
  for (const type of ["character", "npc"]) {
    const model = game.model?.Actor?.[type];
    if (!model) continue;
    foundry.utils.setProperty(model, `attributes.spells.spellbooks.${BOOK}`, bookDefaults());
  }
}

function extendConfig() {
  const cfg = pf1.config;
  Object.assign(cfg.spellSchools, DISCIPLINES);
  cfg.spellcasting.spells.psionic = "PSIONICS.Psionic";
}

/** Procura, subindo a cadeia de protótipos, o protótipo que define `name` (método ou getter). */
function findOwner(cls, name) {
  for (let proto = cls?.prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
    if (Object.prototype.hasOwnProperty.call(proto, name)) return proto;
  }
  return null;
}

/**
 * O PF1 zera concentration.total e cl.total a cada preparação só para os quatro grimórios fixos.
 * Sem isso, o grimório psiônico quebra no meio da preparação (concentração NaN, PP máximo vazio,
 * níveis "inválidos" sem botão de usar) e o NC acumula a cada re-render.
 */
function patchActorPreparation() {
  // O método é sobrescrito em subclasses; corrige o que cada tipo de ator realmente usa.
  const owners = new Set(
    ["character", "npc"].map(type => findOwner(CONFIG.Actor.documentClasses?.[type], "_getInherentTotalsKeys")).filter(Boolean),
  );
  if (!owners.size) {
    console.error(`${MODULE_ID} | Could not find ActorPF#_getInherentTotalsKeys; psionic book totals will not reset.`);
    return;
  }
  for (const owner of owners) {
    const original = owner._getInherentTotalsKeys;
    owner._getInherentTotalsKeys = function (...args) {
      const keys = original.apply(this, args);
      keys[`attributes.spells.spellbooks.${BOOK}.concentration.total`] = 0;
      keys[`attributes.spells.spellbooks.${BOOK}.cl.total`] = 0;
      return keys;
    };
  }
}

/** Buffs com alvo "Nível de conjurador (todos)" e "Concentração (todos)" também valem para os poderes. */
function onGetChangeFlat(result, target) {
  if (target === "cl") result.push(`system.attributes.spells.spellbooks.${BOOK}.cl.total`);
  else if (target === "concentration") result.push(`system.attributes.spells.spellbooks.${BOOK}.concentration.total`);
}

/**
 * Ao soltar um poder na ficha, o PF1 pergunta se é poção/pergaminho/varinha sempre que a aba ativa
 * não é "spellbook". Poderes não viram consumíveis: durante esse drop a ficha diz que está em "spellbook".
 */
function patchActorSheetDrop() {
  const SheetCls = pf1.applications.actor?.ActorSheetPF;
  const tabOwner = findOwner(SheetCls, "currentPrimaryTab");
  const dropOwner = findOwner(SheetCls, "_onDropItemCreate");
  if (!tabOwner || !dropOwner) {
    console.error(`${MODULE_ID} | Could not patch ActorSheetPF drop handling.`);
    return;
  }
  const tabDescriptor = Object.getOwnPropertyDescriptor(tabOwner, "currentPrimaryTab");
  Object.defineProperty(tabOwner, "currentPrimaryTab", {
    ...tabDescriptor,
    get() {
      if (this._psionicsDropping) return "spellbook";
      return tabDescriptor.get.call(this);
    },
  });

  const originalDrop = dropOwner._onDropItemCreate;
  dropOwner._onDropItemCreate = async function (data, ...args) {
    const entries = Array.isArray(data) ? data : [data];
    const hasPower = entries.some(d => d?.type === "spell" && d.flags?.[MODULE_ID]?.power);
    if (!hasPower) return originalDrop.call(this, data, ...args);
    this._psionicsDropping = true;
    try {
      return await originalDrop.call(this, data, ...args);
    } finally {
      this._psionicsDropping = false;
    }
  };
}

/** Tira os poderes do navegador de magias do PF1 e as disciplinas do filtro de escolas dele. */
function patchSpellBrowser() {
  const CB = pf1.applications.compendiumBrowser;
  const SpellBrowser = CB.SpellBrowser;
  const baseIncluded = CB.CompendiumBrowser.prototype.isPackIncluded;
  SpellBrowser.prototype.isPackIncluded = function (pack) {
    if (isPowerPack(pack)) return false;
    return baseIncluded.call(this, pack);
  };

  const SchoolFilter = CB.filters?.spell?.SpellSchoolFilter;
  if (SchoolFilter) {
    const basePrepare = SchoolFilter.prototype.prepareChoices;
    SchoolFilter.prototype.prepareChoices = function (...args) {
      const result = basePrepare.apply(this, args);
      if (!(this.compendiumBrowser instanceof getPowerBrowserClass())) {
        for (const key of Object.keys(DISCIPLINES)) this.choices?.delete(key);
      }
      return result;
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  Navegador de poderes                                                      */
/* -------------------------------------------------------------------------- */

let PowerBrowserClass = null;

function getPowerBrowserClass() {
  if (PowerBrowserClass) return PowerBrowserClass;
  const CB = pf1.applications.compendiumBrowser;
  const F = CB.filters;

  class DisciplineFilter extends F.CheckboxFilter {
    static label = "PSIONICS.Discipline.Label";
    static indexField = "system.school";
    static type = "spell";
    prepareChoices() {
      this.choices = this.constructor.getChoicesFromConfig(
        Object.fromEntries(Object.entries(DISCIPLINES).map(([k, v]) => [k, localize(v)])),
      );
    }
  }

  class SpecializationFilter extends F.CheckboxFilter {
    static label = "PSIONICS.Specialization.Label";
    static indexField = "system.learnedAt.domain";
    static type = "spell";
    prepareChoices() {
      this.choices = this.constructor.getChoicesFromConfig(
        Object.fromEntries(Object.entries(SPECIALIZATIONS).map(([k, v]) => [k, localize(v)])),
      );
    }
  }

  // Os filtros de nível e classe precisam manter o nome original: o PF1 aplica os filtros
  // pré-selecionados (nível/classe do grimório) procurando pelo nome da classe do filtro.
  PowerBrowserClass = class PowerBrowser extends CB.CompendiumBrowser {
    static typeName = "PSIONICS.Powers";
    static filterClasses = [
      F.common?.PackFilter,
      DisciplineFilter,
      F.spell?.SpellLevelFilter,
      F.spell?.SpellLearnedByClassFilter,
      SpecializationFilter,
      F.spell?.SpellDescriptorFilter,
    ].filter(Boolean);

    isPackIncluded(pack) {
      return isPowerPack(pack) && super.isPackIncluded(pack);
    }
  };
  return PowerBrowserClass;
}

export function getPowerBrowser() {
  const compendiums = pf1.applications.compendiums;
  if (!(compendiums.powers instanceof getPowerBrowserClass())) {
    const Cls = getPowerBrowserClass();
    compendiums.powers = new Cls();
  }
  return compendiums.powers;
}

export function openPowerBrowser({ level, classTag } = {}) {
  const browser = getPowerBrowser();
  const filters = {};
  if (level !== undefined && level !== null && level !== "") filters.level = [Number(level)];
  if (classTag && classTag !== "_hd") filters.class = [classTag];
  browser._queueFilters(filters);
  browser._render(true, { focus: true });
}

/* -------------------------------------------------------------------------- */
/*  Ficha: aba Poderes                                                        */
/* -------------------------------------------------------------------------- */

function onRenderActorSheet(app, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const actor = app.actor;
  if (!root || !actor) return;

  const book = getBook(actor);
  if (!book?.inUse) return;

  const nav = root.querySelector('nav.sheet-navigation[data-group="primary"]');
  const body = root.querySelector("section.primary-body");
  const spellsTab = body?.querySelector('.tab[data-group="primary"][data-tab="spellbook"]');
  const bookEl = spellsTab?.querySelector(`.spellbook-group[data-tab="${BOOK}"]`);
  if (!nav || !body || !spellsTab || !bookEl) return;
  if (nav.querySelector(`a.item[data-tab="${TAB}"]`)) return;

  // 1) Tira o grimório psiônico da aba Magias.
  spellsTab.querySelector(`nav.spellbooks a[data-tab="${BOOK}"]`)?.remove();
  const otherBooks = Object.entries(actor.system.attributes.spells.spellbooks)
    .some(([key, b]) => key !== BOOK && b?.inUse);

  // 2) Monta a aba Poderes com o mesmo conteúdo (e os mesmos listeners) do PF1.
  const tab = document.createElement("div");
  tab.className = "tab spellbook psionics-tab flexcol";
  tab.dataset.group = "primary";
  tab.dataset.tab = TAB;
  const wrapper = document.createElement("section");
  wrapper.className = "spellbooks-body";
  bookEl.classList.remove("tab");
  bookEl.classList.add("active");
  delete bookEl.dataset.group;
  wrapper.append(bookEl);
  tab.append(wrapper);
  body.append(tab);

  const link = document.createElement("a");
  link.className = "item";
  link.dataset.tab = TAB;
  link.dataset.group = "primary";
  link.textContent = localize("PSIONICS.Tab");
  const spellsLink = nav.querySelector('a.item[data-tab="spellbook"]');
  const anchor = spellsLink ?? nav.querySelector('a.item[data-tab="buffs"]');
  if (anchor) anchor.after(link);
  else nav.append(link);

  // 3) Sem outros grimórios, a aba Magias fica vazia: remove.
  const primary = app._tabs?.find(t => t.group === "primary");
  if (!otherBooks) {
    spellsLink?.remove();
    spellsTab.remove();
    if (primary?.active === "spellbook") primary.active = TAB;
  } else {
    // Se a sub-aba ativa era a psiônica, ativa o primeiro grimório que sobrou.
    const books = app._tabs?.find(t => t.group === "spellbooks");
    if (books?.active === BOOK) {
      const first = spellsTab.querySelector("nav.spellbooks a.item[data-tab]")?.dataset.tab;
      if (first) books.activate(first);
    }
  }

  relabel(tab);
  interceptBrowse(tab, actor);

  // 4) Mantém a aba Poderes aberta depois de re-renders (adicionar/editar um poder, etc.).
  //    O Foundry religa as abas antes deste hook, quando a aba ainda não existe, e cai na primeira.
  for (const item of nav.querySelectorAll("a.item[data-tab]")) {
    item.addEventListener("click", () => { app._psionicsTabActive = item.dataset.tab === TAB; });
  }
  if (app._psionicsTabActive || primary?.active === TAB) {
    app._psionicsTabActive = true;
    primary?.activate(TAB);
  }
}

/** Troca os textos de "magia" por "poder" dentro da aba. */
function relabel(tab) {
  const ppTitle = tab.querySelector(".spell-points-current h3");
  if (ppTitle) ppTitle.textContent = localize("PSIONICS.PowerPoints");
  const clTitle = tab.querySelector(".spellcasting-cl h5 a");
  if (clTitle) clTitle.textContent = localize("PSIONICS.ManifesterLevel");
  for (const a of tab.querySelectorAll('a[data-action="browse"]')) a.dataset.tooltip = "PSIONICS.BrowsePowers";
  for (const el of tab.querySelectorAll('.spell-school [data-tooltip="PF1.SpellSchool"]')) el.dataset.tooltip = "PSIONICS.Discipline.Label";
}

/** O botão de procurar da aba abre o navegador de poderes em vez do de magias. */
function interceptBrowse(tab, actor) {
  tab.addEventListener("click", event => {
    const button = event.target.closest('a[data-action="browse"]');
    if (!button || !tab.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openPowerBrowser({ level: button.dataset.level, classTag: getBook(actor)?.class });
  }, true);
}

/* -------------------------------------------------------------------------- */
/*  Classes psiônicas e pontos de poder                                       */
/* -------------------------------------------------------------------------- */

/** @psionics.pp = soma, por classe psiônica, da tabela de PP + (mod. do atributo-chave × nível ÷ 2). */
function onGetRollData(doc, rollData) {
  if (!(doc instanceof Actor)) return;
  const classes = {};
  let pp = 0;
  for (const cls of doc.itemTypes?.class ?? []) {
    const flags = cls.flags?.[MODULE_ID];
    if (!flags?.ppTable?.length) continue;
    const level = Math.clamp(Number(cls.system.level) || 0, 0, 20);
    if (!level) continue;
    const base = Number(flags.ppTable[level - 1]) || 0;
    const mod = flags.psionic && flags.keyAbility ? (rollData.abilities?.[flags.keyAbility]?.mod ?? 0) : 0;
    const bonus = Math.max(0, Math.floor((mod * level) / 2));
    classes[cls.system.tag] = { level, base, bonus, pp: base + bonus };
    pp += base + bonus;
  }
  rollData.psionics = { pp, classes };
}

async function enableBookForClass(actor, cls) {
  const flags = cls.flags?.[MODULE_ID] ?? {};
  const book = getBook(actor);
  // Um grimório só: se já estiver ligado a outra classe psiônica, só soma os PP (via @psionics.pp).
  if (book?.inUse && book.class && book.class !== cls.system.tag) return;
  await actor.update({
    [`${BOOK_PATH}.inUse`]: true,
    [`${BOOK_PATH}.class`]: cls.system.tag,
    [`${BOOK_PATH}.ability`]: flags.keyAbility || "int",
    [`${BOOK_PATH}.casterType`]: flags.casterType || "high",
    [`${BOOK_PATH}.kind`]: "psionic",
    [`${BOOK_PATH}.autoSpellLevelCalculation`]: false,
    [`${BOOK_PATH}.spellPoints.useSystem`]: true,
    [`${BOOK_PATH}.spellPoints.maxFormula`]: "@psionics.pp",
  });
  ui.notifications.info(game.i18n.format("PSIONICS.Notify.BookEnabled", { class: cls.name }));
}

async function onCreateItem(item, options, userId) {
  if (userId !== game.user.id) return;
  const actor = item.actor;
  if (!actor) return;
  if (item.type === "class" && item.flags?.[MODULE_ID]?.psionic) {
    await enableBookForClass(actor, item);
  } else if (isPower(item) && !getBook(actor)?.inUse) {
    await actor.update({ [`${BOOK_PATH}.inUse`]: true });
  }
}

async function onDeleteItem(item, options, userId) {
  if (userId !== game.user.id) return;
  const actor = item.actor;
  if (!actor || item.type !== "class") return;
  const book = getBook(actor);
  if (book?.inUse && book.class === item.system.tag) {
    await actor.update({ [`${BOOK_PATH}.inUse`]: false, [`${BOOK_PATH}.class`]: "" });
  }
}

/** Todo poder adicionado a um ator vai para o grimório psiônico (o PF1 usaria o grimório aberto). */
function onPreCreateItem(item) {
  if (item.type !== "spell" || !item.parent) return;
  const flagged = item.flags?.[MODULE_ID]?.power;
  if (flagged && item.system.spellbook !== BOOK) item.updateSource({ "system.spellbook": BOOK });
  else if (!flagged && item.system.spellbook === BOOK) item.updateSource({ [`flags.${MODULE_ID}.power`]: true });
}

/* -------------------------------------------------------------------------- */
/*  Hooks                                                                     */
/* -------------------------------------------------------------------------- */

Hooks.once("init", () => {
  registerBookDefaults();
  extendConfig();
  patchActorPreparation();
  patchActorSheetDrop();
  patchSpellBrowser();
  game.modules.get(MODULE_ID).api = { openPowerBrowser, getPowerBrowser, getBook, BOOK };
});

Hooks.once("ready", () => {
  // Cria o navegador junto com os do PF1 (que são criados no ready).
  try { getPowerBrowser(); } catch (err) { console.error(`${MODULE_ID} | Power browser`, err); }
});

for (const hook of ["renderActorSheetPFCharacter", "renderActorSheetPFNPC"]) {
  Hooks.on(hook, onRenderActorSheet);
}
Hooks.on("pf1GetRollData", onGetRollData);
Hooks.on("pf1GetChangeFlat", onGetChangeFlat);
Hooks.on("preCreateItem", onPreCreateItem);
Hooks.on("createItem", onCreateItem);
Hooks.on("deleteItem", onDeleteItem);
