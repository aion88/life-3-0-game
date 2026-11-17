/** Atelier de l'Atlas (dev seulement) : monte l'écran sur `data.json`. `?monde=wNN` simule la fin du jeu et allume ce monde. */
import { createAtlasScreen } from '../screens/atlas';
import raw from './data.json';
import enRaw from './data.en.json';
import { buildAtlas, type EnglishData } from './model';
import { parseAtlas } from './schema';

const app = document.getElementById('app');
if (!app) throw new Error('#app introuvable');
const params = new URLSearchParams(location.search);
const arrival = params.get('monde') ?? undefined;
const lang = params.get('lang') === 'en' ? 'en' : 'fr';
const data = buildAtlas(parseAtlas(raw), lang === 'en' ? (enRaw as unknown as EnglishData) : undefined);
const screen = createAtlasScreen(data, arrival === undefined ? { lang } : { arrival, lang });
void screen.mount(app);
