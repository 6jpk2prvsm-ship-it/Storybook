'use strict';

const $ = id => document.getElementById(id);
const trail = [];
let book;
let sceneId = 'start';
let shelfEntries = [];

function filterShelf() {
  const age = $('filterAge').value;
  const category = $('filterType').value;
  const tag = $('filterTheme').value;
  const range = age ? age.split('-').map(Number) : null;
  const matches = shelfEntries.filter(entry =>
    (!range || (entry.ageRange[0] <= range[1] && entry.ageRange[1] >= range[0])) &&
    (!category || entry.category === category) &&
    (!tag || entry.tags.includes(tag)));
  $('storyCards').replaceChildren(...matches.map(createCard));
  $('shelfCount').textContent = matches.length + (matches.length === 1 ? ' story' : ' stories') +
    (matches.length === shelfEntries.length ? ' to explore' : ' of ' + shelfEntries.length + ' stories');
  $('shelfEmpty').classList.toggle('hidden', matches.length > 0);
  $('clearFilters').hidden = !age && !category && !tag;
  try { localStorage.setItem('wpw-shelf-filters', JSON.stringify({age, category, tag})); } catch {}
}

function resetFilters() {
  for (const id of ['filterAge', 'filterType', 'filterTheme']) $(id).value = '';
  filterShelf();
}

function fillFilter(id, values) {
  for (const value of [...new Set(values)].sort((a, b) => a.localeCompare(b))) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value.charAt(0).toUpperCase() + value.slice(1);
    $(id).append(option);
  }
}

async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load ' + url);
  return response.json();
}

function choicesAt(id, visited) {
  return (book.nodes[id]?.choices || []).filter(([, , need]) => !need || visited.includes(need));
}

function save() {
  try {
    localStorage.setItem(book.saveKey, JSON.stringify({current: sceneId, history: trail}));
  } catch {
    // Reading can continue when local storage is unavailable.
  }
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(book.saveKey));
    if (!Array.isArray(saved?.history)) return;
    const route = [...saved.history, saved.current];
    if (route[0] !== 'start' || route.length > Object.keys(book.nodes).length) return;
    if (!route.every((id, i) => Object.hasOwn(book.nodes, id) &&
        (i === 0 || choicesAt(route[i - 1], route.slice(0, i - 1)).some(choice => choice[1] === id)))) return;
    sceneId = saved.current;
    trail.push(...saved.history);
  } catch {
    // Unreadable progress falls back to the opening.
  }
}

function renderParagraph(paragraph) {
  const text = typeof paragraph === 'string' ? paragraph :
    paragraph.variants.find(variant => variant.visited.every(id => trail.includes(id))).text;
  const p = document.createElement('p');
  // The existing stories use this one style of emphasis for sounds.
  text.split(/(<strong class="sound">[\s\S]*?<\/strong>)/).forEach((part, i) => {
    if (i % 2 === 0) {
      p.append(document.createTextNode(part));
    } else {
      const strong = document.createElement('strong');
      strong.className = 'sound';
      strong.textContent = part.slice('<strong class="sound">'.length, -'</strong>'.length);
      p.append(strong);
    }
  });
  return p;
}

function scrollToTop() {
  window.scrollTo({top: 0, behavior: 'instant'});
}

function render() {
  const scene = book.nodes[sceneId];
  $('sceneTitle').textContent = scene.title;
  $('sceneNumber').textContent = scene.number;
  $('storyText').replaceChildren(...scene.text.map(renderParagraph));
  $('progressBar').style.width = scene.progress + '%';
  $('progressPercent').textContent = scene.progress + '%';
  $('progressLabel').textContent = scene.ending ? 'Adventure complete' :
    sceneId === 'start' ? 'Your adventure begins' :
    book.id === 'moonseed' ? 'On the way to the Moon Garden' : 'Following the evidence';
  $('typeLabel').textContent = scene.ending ? 'A happy ending' : book.type;
  $('choices').replaceChildren();
  for (const [[label, target], i] of choicesAt(sceneId, trail).map((choice, i) => [choice, i])) {
    const button = document.createElement('button');
    button.className = 'choice';
    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = String.fromCharCode(65 + i);
    const caption = document.createElement('span');
    caption.className = 'label';
    caption.textContent = label;
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '›';
    button.append(letter, caption, arrow);
    button.onclick = () => {
      trail.push(sceneId);
      sceneId = target;
      render();
    };
    $('choices').append(button);
  }
  $('choicePrompt').textContent = scene.prompt || '';
  $('choiceArea').classList.toggle('hidden', !!scene.ending);
  $('endingArea').classList.toggle('hidden', !scene.ending);
  $('backrow').classList.toggle('hidden', !!scene.ending);
  $('backButton').disabled = !trail.length;
  $('endingBack').disabled = !trail.length;
  document.title = scene.title + ' · Where Pages Wander';
  save();
  $('sceneTitle').focus({preventScroll: true});
  scrollToTop();
}

function back() {
  if (!trail.length) return;
  sceneId = trail.pop();
  render();
}

function restart() {
  trail.length = 0;
  sceneId = 'start';
  render();
}

async function openStory(entry) {
  const buttons = [...$('storyCards').querySelectorAll('button')];
  buttons.forEach(button => { button.disabled = true; });
  $('catalogStatus').textContent = 'Opening ' + entry.title + '…';
  try {
    book = await getJSON(entry.file);
    trail.length = 0;
    sceneId = 'start';
    restore();
    $('ageLabel').textContent = 'A choose-your-own adventure · Ages ' + book.age;
    $('bookTitle').textContent = book.title;
    $('bookSubtitle').textContent = book.subtitle;
    $('library').classList.add('hidden');
    for (const id of ['reader', 'restartTop', 'homeButton']) $(id).classList.remove('hidden');
    render();
    $('catalogStatus').textContent = '';
  } catch {
    $('catalogStatus').textContent = 'That story could not be opened. Check your connection and try again.';
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

function showLibrary() {
  for (const id of ['reader', 'restartTop', 'homeButton']) $(id).classList.add('hidden');
  $('library').classList.remove('hidden');
  document.title = 'Choose a story · Where Pages Wander';
  $('libraryTitle').focus({preventScroll: true});
  scrollToTop();
}

function createCard(entry) {
  const card = document.createElement('article');
  card.className = 'story-card';
  card.innerHTML = '<div class="cover" aria-hidden="true"></div><div class="card-body"><span class="pill"></span><h2></h2><p></p><button class="action primary"></button></div>';
  const cover = card.querySelector('.cover');
  cover.classList.add({loch:'loch-cover', moonseed:'garden-cover'}[entry.id] || 'letter-cover');
  cover.textContent = entry.icon;
  card.querySelector('.pill').textContent = entry.type.replace(/ adventure$/, '') + ' · Ages ' + entry.age;
  const themes = document.createElement('div');
  themes.className = 'story-tags';
  for (const tag of entry.tags) {
    const chip = document.createElement('span');
    chip.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
    themes.append(chip);
  }
  card.querySelector('p').after(themes);
  card.querySelector('h2').textContent = entry.title;
  card.querySelector('p').textContent = entry.description;
  const button = card.querySelector('button');
  button.textContent = entry.button;
  button.onclick = () => openStory(entry);
  return card;
}

async function loadShelf() {
  try {
    shelfEntries = (await getJSON('./catalog.json')).map(entry => ({
      ...entry,
      ageRange: entry.ageRange || entry.age.match(/\d+/g).map(Number),
      category: entry.category || entry.type.replace(/ adventure$/i, ''),
      tags: entry.tags || []
    }));
    fillFilter('filterType', shelfEntries.map(entry => entry.category));
    fillFilter('filterTheme', shelfEntries.flatMap(entry => entry.tags));
    try {
      const saved = JSON.parse(localStorage.getItem('wpw-shelf-filters'));
      for (const [id, key] of [['filterAge', 'age'], ['filterType', 'category'], ['filterTheme', 'tag']]) {
        if (saved && [...$(id).options].some(option => option.value === saved[key])) $(id).value = saved[key];
      }
    } catch {}
    for (const id of ['filterAge', 'filterType', 'filterTheme']) {
      $(id).disabled = false;
      $(id).onchange = filterShelf;
    }
    $('clearFilters').onclick = resetFilters;
    $('emptyReset').onclick = resetFilters;
    filterShelf();
    $('catalogStatus').textContent = '';
  } catch {
    $('catalogStatus').textContent = 'The bookshelf could not be loaded. Connect to the internet and reload.';
  }
}

async function prepareOffline() {
  if (!('serviceWorker' in navigator)) return;
  const status = $('offlineStatus');
  const ready = () => {
    if (navigator.serviceWorker.controller) status.textContent = '✓ Ready to read offline on this device.';
  };
  navigator.serviceWorker.addEventListener('controllerchange', ready);
  status.textContent = 'Preparing the bookshelf for offline reading…';
  try {
    const registration = await navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'});
    ready();
    const watch = worker => worker?.addEventListener('statechange', () => {
      if (worker.state === 'redundant' && !navigator.serviceWorker.controller) {
        status.textContent = 'Offline setup could not finish. Reload while connected to try again.';
      }
    });
    watch(registration.installing);
    registration.addEventListener('updatefound', () => watch(registration.installing));
  } catch {
    status.textContent = 'Offline setup could not finish. Reload while connected to try again.';
  }
}

$('restartTop').onclick = restart;
$('restartButton').onclick = restart;
$('backButton').onclick = back;
$('endingBack').onclick = back;
$('homeButton').onclick = showLibrary;
showLibrary();
loadShelf();
prepareOffline();
