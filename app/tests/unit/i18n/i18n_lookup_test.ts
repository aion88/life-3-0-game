import { describe, expect, it } from 'vitest';
import { createI18n, detectLang, ruleFor } from '../../../src/i18n/i18n';
import type { I18nIssue, StringMeta } from '../../../src/i18n/i18n';
import type { Lang } from '../../../src/shared/types/common';

const tables = { fr: { 'a.hello': 'Bonjour {name}', 'a.years.one': '{n} an', 'a.years.other': '{n} ans', 'w10.bracelet': 'Il te reste {words} mots.', 'b.flagged': '{n} lignes signalées' },
                 en: { 'a.hello': 'Hello {name}', 'a.years.one': '{n} year', 'a.years.other': '{n} years', 'w10.bracelet': '{words} words left.', 'b.flagged': '{n} lines flagged' } };
const meta: StringMeta = { 'w10.bracelet': { policy: 'inventory', numericParams: ['words'] }, 'a.years': { policy: 'inventory', numericParams: ['n'] }, 'b.flagged': { policy: 'bilan', numericParams: ['n'] } };

describe('i18n lookup', () => {
  it('test_lookup_switch_and_notify', () => {
    const seen: Lang[] = []; const i = createI18n(tables, meta, 'fr', { mode: 'dev', report: () => {} });
    i.onChange(l => seen.push(l)); expect(i.t('a.hello', { name: 'Nadia' })).toBe('Bonjour Nadia');
    i.setLang('en'); expect(i.t('a.hello', { name: 'Nadia' })).toBe('Hello Nadia'); expect(seen).toEqual(['en']);
  });
  it('test_plural_rules_per_language', () => {
    const i = createI18n(tables, meta, 'fr', { mode: 'dev', report: () => {} });
    expect(i.tPlural('a.years', 0, { n: 0 })).toBe('0 an'); expect(i.tPlural('a.years', 2, { n: 2 })).toBe('2 ans');
    i.setLang('en'); expect(i.tPlural('a.years', 0, { n: 0 })).toBe('0 years');
  });
  it('test_missing_key_dev_throws_prod_falls_back', () => {
    expect(() => createI18n(tables, meta, 'fr', { mode: 'dev', report: () => {} }).t('nope')).toThrow();
    const issues: I18nIssue[] = []; const p = createI18n({ fr: {}, en: { only: 'EN' } }, {}, 'fr', { mode: 'prod', report: x => issues.push(x) });
    expect(p.t('only')).toBe('EN'); expect(p.t('nope')).toBe('nope'); expect(issues.map(x => x.code)).toEqual(['missing-key', 'missing-key']);
  });
  it('test_undeclared_numeric_param_rejected', () => {
    const dev = createI18n(tables, meta, 'fr', { mode: 'dev', report: () => {} });
    expect(dev.t('w10.bracelet', { words: 40 })).toBe('Il te reste 40 mots.');
    expect(() => dev.t('a.hello', { name: 40 })).toThrow(/numeric/);
    expect(() => dev.t('a.hello', { name: '40' })).toThrow(/numeric/);
    const issues: I18nIssue[] = []; const prod = createI18n(tables, meta, 'fr', { mode: 'prod', report: x => issues.push(x) });
    expect(prod.t('a.hello', { name: 40 })).toBe('Bonjour 40'); expect(issues[0]!.code).toBe('numeric-param');
  });
  it('test_bilan_zero_count_rejected', () => {
    const dev = createI18n(tables, meta, 'fr', { mode: 'dev', report: () => {} });
    expect(dev.t('b.flagged', { n: 3 })).toBe('3 lignes signalées'); expect(() => dev.t('b.flagged', { n: 0 })).toThrow(/numeric/); // jamais « 0 an » [GDD 06 B-V1]
  });
  it('test_detect_lang_regional_and_unknown', () => {
    expect(detectLang(['fr-CA'])).toBe('fr'); expect(detectLang(['en-GB'])).toBe('en'); expect(detectLang(['de-DE'])).toBe('en');
    expect(detectLang(['de', 'fr-FR'])).toBe('fr'); expect(detectLang([])).toBe('en'); expect(detectLang(undefined)).toBe('en');
  });
  it('test_rule_longest_prefix_wins', () => {
    expect(ruleFor({ 'w10': { policy: 'voice' }, 'w10.card': { policy: 'inventory' } }, 'w10.card.nadia').policy).toBe('inventory');
    expect(ruleFor({}, 'x.y').policy).toBe('voice');
  });
  it('test_voice_declared_numeric_param_accepted', () => {
    const m: StringMeta = { 'w10.day': { policy: 'voice', allowCalendar: true, numericParams: ['hour'] } };
    const t = { fr: { 'w10.day.appt': 'Rendez-vous à {hour} h' }, en: { 'w10.day.appt': 'Meeting at {hour}' } };
    const dev = createI18n(t, m, 'fr', { mode: 'dev', report: () => {} });
    expect(dev.t('w10.day.appt', { hour: 14 })).toBe('Rendez-vous à 14 h');
    const undeclared = createI18n({ fr: { 'w10.day.appt': 'Rendez-vous à {when} h' }, en: { 'w10.day.appt': 'Meeting at {when}' } }, m, 'fr', { mode: 'dev', report: () => {} });
    expect(() => undeclared.t('w10.day.appt', { when: 14 })).toThrow(/numeric/);
  });
});
