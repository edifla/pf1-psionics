# PF1 Psionics

Módulo para o **Foundry VTT v13** que adiciona **poderes psiônicos** ao sistema **Pathfinder 1e**
(PF1 11.x). Os poderes funcionam como magias do próprio PF1: têm ficha, ação de manifestar, cartão no
chat, nível de manifestador (NM), CD e pontos de poder (PP), tudo pelas mecânicas que o sistema já tem.

## Instalação pelo manifest

No Foundry, em **Add-on Modules → Install Module**, cole no campo *Manifest URL*:

```
https://github.com/edifla/pf1-psionics/releases/latest/download/module.json
```

Depois, em **Manage Modules**, ative **PF1 Psionics** no mundo (que precisa estar com o sistema
Pathfinder 1e instalado). O manifest aponta sempre para a última release, e o campo de download
aponta para o `module.zip` daquela release.

Versão atual: **0.4.0**. Compatibilidade: Foundry v13 (verificado na 13) com PF1 entre 11.0 e 11.99
(verificado na 11.11).

Para instalar manualmente, baixe o `module.zip` da [página de releases](https://github.com/edifla/pf1-psionics/releases)
e extraia a pasta `pf1-psionics` em `Data/modules/` do Foundry.

## O que o módulo faz

### 1. Poderes como magias do PF1

Cada poder é um Item `spell` do PF1 guardado num **grimório extra chamado "Poderes Psiônicos"**. Assim,
o poder tem exatamente a mesma ficha que uma magia: nível, disciplina (no lugar da escola), alcance,
alvo/área/efeito, duração, teste de resistência, resistência a magias, custo em PP e descrição. Ao
manifestar, o cartão no chat, o NC e a CD usam as regras do próprio PF1.

### 2. Pontos de poder

Os PP usam o sistema de *spell points* do PF1, no grimório psiônico:

- O **máximo** é a fórmula `@psionics.pp`: para cada classe psiônica do personagem, soma-se o valor da
  tabela de PP da classe no seu nível, mais um bônus igual ao **modificador do atributo-chave × nível ÷ 2**
  (mínimo 0). Classes diferentes se somam.
- Ao manifestar um poder, o custo em PP é descontado, como nos PP de qualquer sistema do PF1.
- O atributo-chave, o tipo de conjurador (*casterType*) e o NM vêm da classe psiônica.

### 3. Aba "Poderes" na ficha

Quando o personagem tem o grimório psiônico ativo, a ficha ganha uma aba **Poderes**:

- O grimório sai da aba **Magias** e vai para a sua própria aba, com o mesmo layout das magias
  (níveis, PP atuais e máximos, NM, concentração e alcances).
- Textos são traduzidos para o vocabulário psiônico: "Poder Psiônico", "Pontos de Poder",
  "Nível de Manifestador", "Disciplina" no lugar de "Escola".
- A aba se mantém aberta depois de editar ou adicionar um poder.
- Arrastar um poder para a ficha o põe no grimório psiônico, mesmo se a aba ativa for outra. O PF1
  não o trata como poção, pergaminho ou varinha.

### 4. Ativação do grimório

O grimório psiônico é ligado de duas formas:

- **Automática:** ao adicionar uma classe psiônica do compêndio ao personagem. O grimório fica ligado à
  classe, com o atributo-chave e o tipo de conjurador certos. Se o personagem já tiver outra classe
  psiônica, ela só soma os PP (o grimório é um só).
- **Manual:** em *Configurações → Uso de grimórios*, marque **Poderes Psiônicos**.

Ao remover a classe psiônica, o grimório é desligado (se ele estava ligado a ela).

### 5. Navegador de poderes

O botão de procurar em cada nível da aba Poderes abre um **navegador só de poderes**, já filtrado pelo
nível e pela classe do grimório. Filtros disponíveis:

- **Compêndio** (pack)
- **Disciplina** (Clairsentience, Metacreativity, Psychokinesis, Psychometabolism, Psychoportation, Telepathy)
- **Nível**
- **Classe** (que aprende o poder)
- **Disciplina do psion** (Seer, Shaper, Kineticist, Egoist, Nomad, Telepath)
- **Descritor**

Arraste um poder do navegador para a ficha para adicioná-lo.

O navegador de magias do PF1 **não** mostra os poderes, e o navegador de classes do PF1 mostra as classes
psiônicas normalmente.

### 6. Buffs e debuffs

Os poderes que dão efeitos contínuos têm buffs e debuffs prontos no compêndio **Psionic Buffs**. Eles
são itens de efeito (buff) que você ativa na ficha, com:

- **Bônus numéricos** convertidos em *changes* do PF1. Ex.: *Thicken Skin* dá +1 de melhoria na
  armadura natural.
- **Condições** do PF1 nos debuffs: sickened, dazed, helpless, cowering, shaken, stunned e flat-footed.
- **Notas de contexto** para efeitos que o PF1 não consegue aplicar sozinho (redução de dano, imunidades,
  a borda da Precognição). Eles aparecem como texto no buff.

Buffs com alvo "Nível de conjurador (todos)" ou "Concentração (todos)" também valem para os poderes
psiônicos, já que o módulo registra esses alvos no PF1.

Aumentos (*augment*) não são automáticos: edite a fórmula do buff se quiser usá-los.

## Compêndios

| Compêndio | Conteúdo |
| --- | --- |
| **Psionic Powers** | 119 poderes de disciplina do psion, em pastas por disciplina do psion (Egoist, Kineticist, Nomad, Seer, Shaper, Telepath). |
| **Psionic Classes** | Psion, Psychic Warrior, Wilder, Soulknife, Aegis, Cryptic, Dread, Marksman, Tactician, Vitalist e Voyager. |
| **Psionic Class Features** | Habilidades de classe das classes psiônicas. |
| **Psionic Buffs** | 31 itens: buffs (pasta *Buffs*) e debuffs (pasta *Debuffs*) dos poderes. |

Todos ficam na pasta **Psionics** do menu de compêndios.

### O que foi importado e o que não foi

- **Poderes:** estatísticas (nível, disciplina, descritores, exibição, tempo de manifestação, alcance,
  alvo/área/efeito, duração, resistência, RP e custo em PP), quem aprende o poder (classes e disciplina
  do psion), um resumo de uma linha e o link para o texto completo no d20pfsrd. O texto completo e os
  efeitos de *augment* **não** foram importados.
- **Variantes** (14 poderes, ex.: *Metamorphosis, Minor*) apontam para a página do poder base. Para elas
  foram importados só nível, disciplina e custo, e a descrição avisa isso. *Resist Death* não tem página
  (404) no d20pfsrd.
- **Classes:** dado de vida, BBA, resistências, perícias de classe, perícias por nível, riqueza inicial,
  tabela de PP, poderes conhecidos e nível máximo de poder. As habilidades de classe ficam no compêndio
  de features; a descrição tem o link para a página da classe. *Autohypnosis* e *Knowledge (psionics)* não
  existem no PF1 e ficam listados na descrição.

## Idiomas

O módulo tem tradução para **English** (padrão) e **Português (Brasil)** da interface.

## Como o módulo está organizado

```
module.json              manifest do Foundry (id, versão, compatibilidade, packs, idiomas)
scripts/main.mjs         toda a lógica: grimório, PP, aba Poderes, navegador e drops
styles/psionics.css      estilos da aba e da tabela de progressão das classes
lang/en.json, pt-BR.json textos da interface
packs-src/               fonte dos compêndios, em JSON (um arquivo por item)
packs/                   compêndios LevelDB gerados a partir de packs-src (não vão para o git)
tools/                   scripts que geram os dados (scraping e buffs)
.github/workflows/       release automática
```

### Regerar os dados

Requer Node.js 20 ou superior.

```powershell
npm install
npm run scrape:powers
npm run scrape:classes
npm run build:packs
```

- `scrape:powers` baixa os poderes do d20pfsrd e grava em `packs-src/powers`.
- `scrape:classes` faz o mesmo com as classes em `packs-src/classes`.
- `gen:buffs` (`tools/build-buffs.mjs`) gera os buffs; os buffs são escritos à mão nesse script,
  a partir do texto de cada poder, e não são recriados pelo scraper.
- `build:packs` compila `packs-src/` nos compêndios LevelDB da pasta `packs/`.

O Foundry precisa estar fora do mundo (na tela de Setup) para os compêndios serem substituídos.

## Publicar uma release

O workflow [`.github/workflows/release.yml`](.github/workflows/release.yml) roda ao subir uma tag `v*`:

```powershell
git tag v0.4.0
git push origin v0.4.0
```

Ele compila os compêndios, grava a versão (a partir da tag) e as URLs no `module.json` e anexa à release
o `module.json` e o `module.zip`. Lembre de manter a versão em `module.json` igual à tag.

## Licença

- **Código** (scripts, estilos, ferramentas e textos da interface): [MIT](LICENSE) © 2026 Rafael.
- **Conteúdo dos poderes e classes:** vem do *Psionics Unleashed* / *Psionics Expanded* (Dreamscarred
  Press), publicado como Open Game Content sob a OGL 1.0a, via d20pfsrd.com. Não é de autoria deste
  projeto.
- O módulo é um fan-made não oficial para o Pathfinder 1e e não é afiliado à Paizo nem à Foundry Gaming LLC.
