/* Assembla js/campaign.js dai draft (uso di produzione, una tantum ma ripetibile):
   header (ITEMS) + blocchi scene + CAMPAIGN + footer (CHAPTERS, DIARY_FLAGS, WORLD_MAP).
   Uso: node tests/assemble.mjs */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');

const parts = [
  read('drafts/campaign-header.js'),
  read('drafts/scene-A.js'),
  read('drafts/scene-B.js'),
  read('drafts/scene-C.js'),
  read('drafts/scene-D.js'),
  read('drafts/scene-E.js'),
  read('drafts/scene-HUB.js'),
  `\n/* ============ LA CAMPAGNA COMPLETA ============ */\nconst CAMPAIGN = Object.assign({}, SCENE_A, SCENE_B, SCENE_C, SCENE_D, SCENE_E, SCENE_HUB);\n`,
  read('drafts/campaign-footer.js'),
];

writeFileSync(join(root, 'js/campaign.js'), parts.join('\n'));
console.log('✔ js/campaign.js assemblato:', parts.join('\n').length, 'caratteri');
