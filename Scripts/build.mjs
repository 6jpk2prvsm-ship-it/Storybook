import {createHash} from 'node:crypto';
import {cp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'public');
const output = join(root, 'dist');
const slug = /^[a-z0-9][a-z0-9-]*$/;
const isText = value => typeof value === 'string' && value.trim().length > 0;
const storyFiles = (await readdir(join(source, 'stories'))).filter(name => name.endsWith('.json')).sort();
const catalog = [];
const keys = new Set();

function checkStory(story, filename) {
  const {id, nodes, saveKey} = story;
  const check = (ok, message) => {
    if (!ok) throw new Error(filename + ' · ' + message);
  };
  check(isText(id) && slug.test(id) && filename === id + '.json', 'Filename must match the story id.');
  for (const field of ['title', 'age', 'type', 'subtitle', 'description', 'icon', 'button', 'saveKey']) {
    check(isText(story[field]), 'Missing ' + field + '.');
  }
  check(!keys.has(saveKey), 'Reading progress key is already used by another story.');
  keys.add(saveKey);
  check(nodes && typeof nodes === 'object' && Object.hasOwn(nodes, 'start'), 'Missing start scene.');
  const exists = scene => typeof scene === 'string' && Object.hasOwn(nodes, scene);
  const paragraphOK = paragraph => isText(paragraph) ||
    (Array.isArray(paragraph?.variants) && paragraph.variants.length &&
      paragraph.variants.every(v => Array.isArray(v?.visited) && v.visited.every(exists) && isText(v.text)));

  for (const [sceneId, scene] of Object.entries(nodes)) {
    check(scene && isText(scene.title) && isText(scene.number), sceneId + ' needs a title and label.');
    check(Number.isInteger(scene.progress) && scene.progress >= 0 && scene.progress <= 100,
      sceneId + ' needs progress between 0 and 100.');
    check(Array.isArray(scene.text) && scene.text.length && scene.text.every(paragraphOK),
      sceneId + ' has missing or invalid prose.');
    if (scene.ending === true) {
      check(!scene.choices?.length && scene.progress === 100, sceneId + ' must finish at 100% without choices.');
      continue;
    }
    check(isText(scene.prompt) && Array.isArray(scene.choices) && scene.choices.length,
      sceneId + ' needs a prompt and at least one choice.');
    for (const choice of scene.choices) {
      check(Array.isArray(choice) && choice.length >= 2 && choice.length <= 3 &&
        isText(choice[0]) && exists(choice[1]) && (choice.length === 2 || exists(choice[2])),
      sceneId + ' has an invalid choice or prerequisite.');
    }
  }

  const reached = new Set();
  const offered = new Set();
  const usedVariants = new Set();
  let endings = 0;
  function visit(id, history) {
    check(!history.includes(id), 'Loop on ' + [...history, id].join(' → ') + '.');
    reached.add(id);
    const scene = nodes[id];
    for (const p of scene.text) {
      if (typeof p === 'string') continue;
      const match = p.variants.find(v => v.visited.every(needed => history.includes(needed)));
      check(match, id + ' has no prose variant for ' + history.join(' → ') + '.');
      usedVariants.add(match);
    }
    if (scene.ending) {
      endings++;
      check(endings <= 20000, 'Over 20,000 routes. Reduce the number of branches.');
      return;
    }
    const choices = scene.choices.filter(([, , need]) => !need || history.includes(need));
    check(choices.length, 'Dead end on ' + [...history, id].join(' → ') + '.');
    for (const choice of choices) {
      offered.add(choice);
      visit(choice[1], [...history, id]);
    }
  }
  visit('start', []);
  for (const [id, scene] of Object.entries(nodes)) {
    check(reached.has(id), 'Unreachable scene ' + id + '.');
    check((scene.choices || []).every(choice => offered.has(choice)), id + ' contains a choice that can never appear.');
    for (const p of scene.text) {
      if (typeof p !== 'string') {
        check(p.variants.every(v => usedVariants.has(v)), id + ' contains an unused prose variant.');
      }
    }
  }
  return endings;
}

if (!storyFiles.length) throw new Error('No stories found in public/stories.');
for (const name of storyFiles) {
  const story = JSON.parse(await readFile(join(source, 'stories', name), 'utf8'));
  const routes = checkStory(story, name);
  const {nodes, saveKey, ...entry} = story;
  catalog.push({...entry, file: './stories/' + name});
  console.log(story.title + ' · ' + routes + ' complete routes');
}

const first = ['loch', 'moonseed', 'letter'];
const order = id => first.includes(id) ? first.indexOf(id) : first.length;
catalog.sort((a, b) => order(a.id) - order(b.id));
const catalogJSON = JSON.stringify(catalog, null, 2) + '\n';
const resources = ['index.html', 'reader.js', 'manifest.webmanifest', 'icons/apple-touch-icon.png',
  'icons/icon-192.png', 'icons/icon-512.png', ...storyFiles.map(name => 'stories/' + name)];
const worker = await readFile(join(root, 'scripts/sw-template.js'), 'utf8');
const hash = createHash('sha256').update(worker).update(catalogJSON);
for (const path of resources) hash.update(path).update(await readFile(join(source, path)));
const release = hash.digest('hex').slice(0, 16);

await rm(output, {recursive: true, force: true});
await cp(source, output, {recursive: true});
await writeFile(join(output, 'catalog.json'), catalogJSON);
await writeFile(join(output, 'sw.js'), worker.replace('__RELEASE__', release)
  .replace('__ASSETS__', JSON.stringify(['./', './catalog.json', ...resources.slice(1).map(path => './' + path)])));
console.log('Offline release ' + release + ' built in dist.');
