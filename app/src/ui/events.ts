/** Bus d'événements d'interface : noms seulement, le contenu sonore relève de `sound-designer` [spec C §5, plan UI-C T3]. */

export const UI_EVENT_NAMES = [
  'ui.designate', 'ui.undesignate', 'ui.confirm', 'ui.cost.reveal', 'ui.price.reveal', 'bracelet.coin', 'oeil.shutter', 'bracelet.settle',
  'regime.confetti', 'regime.message', 'ui.refusal.system', 'ui.bubble.in', 'ui.bubble.out', 'ui.card.open', 'ui.card.close', 'ui.page',
] as const;
export type UiEventName = (typeof UI_EVENT_NAMES)[number];

export interface UiEvents {
  emit(name: UiEventName): void;
  /** Abonnement ; rend la fonction de désabonnement. */
  on(cb: (name: UiEventName) => void): () => void;
  /** Journal des événements émis, dans l'ordre. */
  log(): readonly UiEventName[];
  clear(): void;
}

export function createUiEvents(): UiEvents {
  const subs = new Set<(name: UiEventName) => void>();
  let entries: UiEventName[] = [];
  return {
    emit(name) {
      entries.push(name);
      for (const cb of [...subs]) cb(name);
    },
    on(cb) {
      subs.add(cb);
      return () => void subs.delete(cb);
    },
    log: () => [...entries],
    clear() {
      entries = [];
    },
  };
}
