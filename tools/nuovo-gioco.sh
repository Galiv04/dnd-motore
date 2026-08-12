#!/usr/bin/env bash
# ============ nuovo-gioco.sh — scaffolding di un nuovo gioco della serie ============
# Uso: bash tools/nuovo-gioco.sh <nome-repo> "<Titolo del gioco>"
#
# Crea la cartella sorella ../<nome-repo> copiando il motore condiviso (engine/, templates/)
# e prepara uno scheletro pronto per iniziare la produzione (docs/DESIGN.md vuoto, CLAUDE.md
# che punta a questo repo condiviso, git init). Idempotente: si rifiuta di sovrascrivere
# una cartella già esistente.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOTORE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ $# -lt 2 ]; then
  echo "Uso: bash tools/nuovo-gioco.sh <nome-repo> \"<Titolo del gioco>\""
  exit 1
fi

REPO_NAME="$1"
TITOLO="$2"
DEST_DIR="$(cd "$MOTORE_DIR/.." && pwd)/$REPO_NAME"

if [ -e "$DEST_DIR" ]; then
  echo "❌ La cartella esiste già: $DEST_DIR"
  echo "   nuovo-gioco.sh non sovrascrive mai una cartella esistente."
  exit 1
fi

echo "▶ Creo $DEST_DIR"
mkdir -p "$DEST_DIR"/{js,css,tests,drafts,docs,.github/workflows}

echo "▶ Copio il motore (js/, css/, index.html)"
cp "$MOTORE_DIR"/engine/*.js "$DEST_DIR/js/"
cp "$MOTORE_DIR"/engine/style.css "$DEST_DIR/css/style.css"
cp "$MOTORE_DIR"/engine/index.html "$DEST_DIR/index.html"

echo "▶ Copio i template di test e la CI"
cp "$MOTORE_DIR"/templates/validate.mjs "$DEST_DIR/tests/validate.mjs"
cp "$MOTORE_DIR"/templates/playthrough.mjs "$DEST_DIR/tests/playthrough.mjs"
cp "$MOTORE_DIR"/templates/assemble.mjs "$DEST_DIR/tests/assemble.mjs"
cp "$MOTORE_DIR"/templates/ci-tests.yml "$DEST_DIR/.github/workflows/tests.yml"

echo "▶ Copio i draft di produzione (BRIEF, POLISH)"
cp "$MOTORE_DIR"/templates/BRIEF.md "$DEST_DIR/drafts/BRIEF.md"
cp "$MOTORE_DIR"/templates/POLISH.md "$DEST_DIR/drafts/POLISH.md"

echo "▶ Sostituisco il titolo nei segnaposto di index.html"
# Sostituzioni minime e sicure: solo i segnaposto letterali dello scheletro.
python3 - "$DEST_DIR/index.html" "$TITOLO" <<'PYEOF'
import sys
path, titolo = sys.argv[1], sys.argv[2]
with open(path, encoding='utf-8') as f:
    html = f.read()
html = html.replace('<!-- TITOLO DEL GIOCO -->', titolo)
html = html.replace('TITOLO<br>SOTTOTITOLO', titolo.upper())
with open(path, 'w', encoding='utf-8') as f:
    f.write(html)
PYEOF

echo "▶ Creo docs/DESIGN.md (scheletro)"
cat > "$DEST_DIR/docs/DESIGN.md" <<EOF
# $TITOLO — documento di design

## Il seme in una riga

> *<<l'immagine o la situazione di apertura, in una riga>>*

## Tono

<<registro narrativo: cosa è ammesso, cosa no, quanto pauroso/comico/onirico è il gioco>>

## Vincoli

<<vincoli etici o di contenuto non negoziabili, se il gioco coinvolge persone reali o temi sensibili>>

## Meccaniche nuove rispetto al motore condiviso

<<eventuali novità di regole rispetto a quanto già offerto da ../dnd-motore/engine/>>

## Struttura ad atti

<<atti/capitoli, con i prefissi delle scene per ciascuno>>

## Finali

<<elenco dei finali previsti, con la condizione che li sblocca>>

## Convenzioni

<<location ammesse, bestiario, catalogo item — quello che finirà nel BRIEF>>
EOF

echo "▶ Creo CLAUDE.md iniziale"
cat > "$DEST_DIR/CLAUDE.md" <<EOF
# CLAUDE.md — $TITOLO

Gioco della serie D&D di Gali. **Riusa il motore condiviso**: la documentazione completa di
motore, stile narrativo, pipeline di produzione e lezioni apprese vive nel repo
[Galiv04/dnd-motore](https://github.com/Galiv04/dnd-motore) (\`../dnd-motore/docs/\`).

- **Design di questo gioco**: [docs/DESIGN.md](docs/DESIGN.md)
- **Brief di produzione**: [drafts/BRIEF.md](drafts/BRIEF.md)

## Comandi

\`\`\`bash
node tests/validate.mjs      # controlli statici (grafo, dati, sprite, flag)
node tests/playthrough.mjs   # partite simulate headless
node ../dnd-motore/tools/metriche.mjs .   # densità di giocabilità
\`\`\`

Regole operative della serie: test verdi prima di ogni push (la CI li riesegue), audit visivo
sul sito live, niente localhost su questa macchina (si testa headless o su Pages), push con
\`curloptResolve\` se il DNS di github.com è bloccato, cache Pages ~10 minuti. I file del motore
si COPIANO da \`../dnd-motore/engine/\`: non c'è build né dipendenze, quando il motore migliora si
riportano qui i file aggiornati a mano.
EOF

echo "▶ git init"
(cd "$DEST_DIR" && git init -q)

cat <<EOF

✅ Scaffolding creato in: $DEST_DIR

Prossimi passi:
  [ ] Scrivere docs/DESIGN.md (seme, tono, vincoli, atti, finali)
  [ ] Generalizzare drafts/BRIEF.md con i contenuti di questo gioco
  [ ] Scrivere js/characters.js (protagonisti + bestiario)
  [ ] Fare il fan-out delle scene (drafts/scene-*.js) secondo il BRIEF
  [ ] node tests/assemble.mjs   — ricomporre js/campaign.js dai draft
  [ ] node tests/validate.mjs   — deve essere verde
  [ ] node tests/playthrough.mjs — deve essere verde
  [ ] node ../dnd-motore/tools/metriche.mjs .  — soglie di densità rispettate
  [ ] Pubblicare (gh repo create, GitHub Pages)
  [ ] Audit visivo sul sito live (screenshot di ogni schermata e sfondo)
EOF
