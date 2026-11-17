// @vitest-environment happy-dom
/** Pièces graphiques d'une scène : écran de téléphone, papier, carte d'objet. Présentation pure, rien d'inventé. */
import { describe, expect, it } from 'vitest';
import { createPiece, createTicket, cutText, glyphFor, type PieceSpec } from '../../../src/worlds/pieces';

const spec = (prop: PieceSpec['prop'], over: Partial<PieceSpec> = {}): PieceSpec => ({ prop, sender: 'NOOR', title: 'Une roue qui frotte', text: 'La roue de Noor frotte encore et la remorque ne passe plus.', ...over });

describe('pièces graphiques', () => {
  it('test_cutText_cutsAtAWordBoundary_withAnEllipsisInTheText', () => {
    expect(cutText('court', 38)).toBe('court');
    const cut = cutText('Le nécessaire est assuré. L’usage de cet atelier vous appartient.', 38);
    expect(cut.endsWith('…')).toBe(true); expect(cut.length).toBeLessThanOrEqual(39); expect(cut).not.toMatch(/\s…$/);
  });
  it('test_glyphFor_wheelForTheWheel_boxForAnObject_hammerOtherwise', () => {
    expect(glyphFor(spec('tool'))).toBe('wheel');
    expect(glyphFor(spec('tool', { title: 'Le travail qui compte', text: 'L’établi est disponible.' }))).toBe('wrench');
    expect(glyphFor(spec('object'))).toBe('box');
  });
  it('test_piece_eachKind_showsTheSceneSender_andItsText', () => {
    const doc = document;
    for (const prop of ['phone', 'document', 'tool', 'object'] as const) {
      const piece = createPiece(doc, spec(prop, { text: 'Message court.' }));
      expect(piece.el.dataset['prop']).toBe(prop);
      expect(piece.el.textContent, prop).toContain('Message court.');
      if (prop === 'phone' || prop === 'document') expect(piece.el.textContent, prop).toContain('NOOR');
      else expect(piece.el.textContent, prop).toContain('Une roue qui frotte');
    }
    expect(createPiece(doc, spec('tool')).el.classList.contains('metal')).toBe(true);
    expect(createPiece(doc, spec('document')).el.querySelector('.pd-stamp'), 'a stamp zone on the paper').not.toBeNull();
    expect(createPiece(doc, spec('object')).el.querySelector('svg.pc-glyph'), 'a drawing on the card').not.toBeNull();
  });
  it('test_piece_reading_showsTheFullText_andClosesOnTouchOrEscape', () => {
    const host = document.createElement('div'); document.body.append(host);
    const piece = createPiece(document, spec('document')); host.append(piece.el);
    piece.openReading(host);
    const reading = host.querySelector<HTMLElement>('.piece-reading')!;
    expect(reading.textContent).toContain(spec('document').text);
    reading.click(); expect(host.querySelector('.piece-reading')).toBeNull(); expect(piece.el.getAttribute('aria-expanded')).toBe('false');
    piece.openReading(host); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); expect(host.querySelector('.piece-reading')).toBeNull();
  });
  it('test_piece_mark_putsTheChoiceOnThePiece_andWaitsForNothingWhenItCannotBeSeen', () => {
    // Sans mise en page (tests, rien de visible) : la décision n'attend pas.
    const paper = createPiece(document, spec('document')); expect(paper.mark('Réparer la remorque')).toBeNull();
    expect(paper.el.querySelector('.pd-mark')?.textContent).toBe('Réparer la remorque');
    const phone = createPiece(document, spec('phone')); expect(phone.mark('Répondre')).toBeNull();
    expect(phone.el.querySelector('.pp-reply')?.textContent).toBe('Répondre');
    const card = createPiece(document, spec('object')); expect(card.mark('La garder')).toBeNull();
    expect(card.el.querySelector<HTMLElement>('.piece-card')?.dataset['back']).toBe('1');
    expect(card.el.textContent).toContain('La garder');
  });
  it('test_ticket_printsEveryLine_inOrder_andCallsBackOncePerLine', async () => {
    const ticket = createTicket(document, { title: 'Relevé', lines: ['Première.', { label: 'Mots', value: '12' }, { label: 'Total', value: '3', total: true }], foot: 'Fin.' });
    expect([...ticket.el.children].slice(1).every(c => (c as HTMLElement).hidden), 'nothing printed yet').toBe(true);
    const seen: number[] = []; let n = 0;
    await ticket.print(() => seen.push(n++));
    expect(seen.length, 'a callback per line, foot included').toBe(4);
    expect([...ticket.el.children].some(c => (c as HTMLElement).hidden)).toBe(false);
    expect(ticket.el.querySelector('.tp-total')?.textContent).toBe('Total3');
    expect(ticket.el.querySelector('h3')?.textContent).toBe('Relevé');
  });
  it('test_ticket_skip_putsTheRemainingLinesDownAtOnce', () => {
    const ticket = createTicket(document, { title: 'T', lines: ['a', 'b'] });
    ticket.skip(); expect([...ticket.el.children].some(c => (c as HTMLElement).hidden)).toBe(false);
  });
});
