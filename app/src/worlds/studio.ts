/** Read-only live location study. Does not load or write the player's save. */
import { createIllustratedJourneyView as createJourneyView } from './illustratedView';
import { journeys } from './catalogue';
import type { JourneyWorldId } from './types';
import './studio.css';
export async function mountSorayaStudio(root: HTMLElement): Promise<() => void> {
  const params = new URLSearchParams(location.search);
  const allWorlds = params.get('atelier') === 'mondes';
  const requested = params.get('monde') as JourneyWorldId;
  const journey = allWorlds && Object.hasOwn(journeys, requested) ? journeys[requested] : journeys.w02;
  const initial = journey.locations.find(place => place.id === params.get('lieu')) ?? journey.locations[0]!;
  const host = document.createElement('main'); host.className = 'soraya-studio'; root.append(host);
  const canvas = document.createElement('div'); canvas.className = 'soraya-stage'; host.append(canvas);
  const header = document.createElement('header');
  header.innerHTML = '<small>LIFE 3.0 · LIEU TÉMOIN</small><h1>Le logement sans serrure</h1><p>Chez Soraya — une vie organisée, une valise préparée sans son accord.</p>';
  host.append(header);
  const controls = document.createElement('nav'); controls.setAttribute('aria-label', 'Regarder le lieu'); host.append(controls);
  const view = await createJourneyView(canvas, journey);
  view.show(initial.id, []);
  if (allWorlds) {
    header.querySelector('small')!.textContent = 'LIFE 3.0 · ATELIER DES MONDES';
    header.querySelector('h1')!.textContent = initial.name;
    header.querySelector('p')!.textContent = journey.title;
    const selectors = document.createElement('div'); selectors.className = 'studio-selectors'; header.append(selectors);
    const worlds = document.createElement('select'); worlds.setAttribute('aria-label', 'Monde à regarder');
    for (const world of Object.values(journeys)) { const option = document.createElement('option'); option.value = world.id; option.textContent = world.title; worlds.append(option); }
    worlds.value = journey.id;
    worlds.addEventListener('change', () => { const url = new URL(location.href); url.searchParams.set('monde', worlds.value); url.searchParams.delete('lieu'); location.assign(url); });
    const places = document.createElement('select'); places.setAttribute('aria-label', 'Lieu à regarder');
    for (const place of journey.locations) { const option = document.createElement('option'); option.value = place.id; option.textContent = place.name; places.append(option); }
    places.value = initial.id;
    places.addEventListener('change', () => { view.show(places.value, []); view.setFraming?.('wide'); wide.setAttribute('aria-pressed', 'true'); close.setAttribute('aria-pressed', 'false'); header.querySelector('h1')!.textContent = journey.locations.find(place => place.id === places.value)!.name; const url = new URL(location.href); url.searchParams.set('lieu', places.value); history.replaceState(null, '', url); });
    selectors.append(worlds, places);
  }
  let photo = true;
  const button = (text: string, action: () => void): HTMLButtonElement => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.addEventListener('click', action); controls.append(b); return b; };
  const wide = button('Plan d’ensemble', () => { view.setFraming?.('wide'); wide.setAttribute('aria-pressed', 'true'); close.setAttribute('aria-pressed', 'false'); });
  const close = button(allWorlds ? 'Plan rapproché' : 'Plus près de Soraya', () => { view.setFraming?.('portrait'); close.setAttribute('aria-pressed', 'true'); wide.setAttribute('aria-pressed', 'false'); });
  wide.setAttribute('aria-pressed', 'true'); close.setAttribute('aria-pressed', 'false');
  const look = button('Rendu photographique', () => { photo = !photo; view.setPhotographic?.(photo); look.setAttribute('aria-pressed', String(photo)); look.textContent = photo ? 'Rendu photographique' : 'Sans finition photographique'; });
  look.dataset['ui'] = 'photo-toggle'; look.setAttribute('aria-pressed', 'true');
  const link = document.createElement('a'); link.href = '?episode=court'; link.textContent = 'Revenir à ma partie'; controls.append(link);
  const note = document.createElement('p'); note.className = 'soraya-note'; note.textContent = 'Décor illustré · personnages animés · aperçu sans effet sur ta partie'; host.append(note);
  return () => { view.dispose(); host.remove(); };
}
