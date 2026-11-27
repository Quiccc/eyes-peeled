import { CATALOGS, i18n, type Catalog } from '@/i18n';
import { LANGUAGES, matchLocale, pickLocale } from '@/i18n/languages';

const PLURAL = /^(.*?)_(ordinal_)?(zero|one|two|few|many|other)$/;
const placeholders = (s: string) => new Set([...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
const tags = (s: string) => [...s.matchAll(/<\/?\w+>/g)].map((m) => m[0]).sort();

function flat(node: Catalog, prefix = ''): [string, string][] {
  return Object.entries(node).flatMap(([k, v]) => (typeof v === 'string' ? [[prefix + k, v]] : flat(v, `${prefix}${k}.`)));
}

/** en's keys with plural suffixes folded into their base: key -> { ordinal, forms }. */
function shape(entries: [string, string][]) {
  const plain = new Map<string, string>();
  const plural = new Map<string, { ordinal: boolean; forms: Map<string, string> }>();
  for (const [key, text] of entries) {
    const m = PLURAL.exec(key);
    if (!m) {
      plain.set(key, text);
      continue;
    }
    const base = plural.get(m[1]) ?? { ordinal: !!m[2], forms: new Map() };
    base.forms.set(m[3], text);
    plural.set(m[1], base);
  }
  return { plain, plural };
}

const en = shape(flat(CATALOGS.en));

describe.each(LANGUAGES.filter((l) => l.locale !== 'en'))('$name ($locale) catalog', ({ locale }) => {
  const catalog = shape(flat(CATALOGS[locale]));

  it('has every plain string, with the same placeholders and tags', () => {
    expect([...catalog.plain.keys()].sort()).toEqual([...en.plain.keys()].sort());
    for (const [key, text] of en.plain) {
      const translated = catalog.plain.get(key)!;
      expect({ key, placeholders: placeholders(translated) }).toEqual({ key, placeholders: placeholders(text) });
      expect({ key, tags: tags(translated) }).toEqual({ key, tags: tags(text) });
    }
  });

  it('has exactly the plural forms the language uses', () => {
    expect([...catalog.plural.keys()].sort()).toEqual([...en.plural.keys()].sort());
    for (const [base, { ordinal, forms }] of en.plural) {
      const categories = new Intl.PluralRules(locale, { type: ordinal ? 'ordinal' : 'cardinal' }).resolvedOptions().pluralCategories;
      const got = catalog.plural.get(base)!;
      expect({ base, forms: [...got.forms.keys()].sort() }).toEqual({ base, forms: [...categories].sort() });
      // Every form keeps the named placeholders; {{count}} may be left out (e.g. "the only one today").
      const want = new Set([...forms.values()].flatMap((f) => [...placeholders(f)]).filter((p) => p !== 'count'));
      for (const [category, text] of got.forms) {
        const missing = [...want].filter((p) => !placeholders(text).has(p));
        expect({ base, category, missing }).toEqual({ base, category, missing: [] });
      }
    }
  });
});

describe('translating', () => {
  afterEach(() => i18n.changeLanguage('en'));

  it('picks the plural form for the count', async () => {
    await i18n.changeLanguage('ru');
    expect(i18n.t('stats.days', { count: 1 })).toBe('1 день');
    expect(i18n.t('stats.days', { count: 3 })).toBe('3 дня');
    expect(i18n.t('stats.days', { count: 5 })).toBe('5 дней');
    await i18n.changeLanguage('en');
    expect(i18n.t('stats.days', { count: 1 })).toBe('1 day');
    expect(i18n.t('stats.days', { count: 2 })).toBe('2 days');
  });

  it('writes ordinals the way each language does', async () => {
    const rank = (n: number) => i18n.t('format.rank', { count: n, ordinal: true });
    expect([1, 2, 3, 11, 22].map(rank)).toEqual(['1st', '2nd', '3rd', '11th', '22nd']);
    await i18n.changeLanguage('fr');
    expect([1, 2].map(rank)).toEqual(['1er', '2e']);
    await i18n.changeLanguage('de');
    expect(rank(3)).toBe('3.');
  });

  it('fills components in rich text', async () => {
    await i18n.changeLanguage('es');
    expect(i18n.t('signIn.legal')).toContain('<terms>Términos</terms>');
  });
});

describe('language matching', () => {
  it('matches a device language to the closest supported one', () => {
    expect(matchLocale('pt-PT')).toBe('pt-BR');
    expect(matchLocale('zh-Hant-TW')).toBe('zh-Hans');
    expect(matchLocale('es_MX')).toBe('es');
    expect(matchLocale('in-ID')).toBe('id');
    expect(matchLocale('xx')).toBeNull();
    expect(matchLocale(undefined)).toBeNull();
  });

  it('takes the first supported device language, else English', () => {
    expect(pickLocale(['nl-NL', 'de-AT', 'fr-FR'])).toBe('de');
    expect(pickLocale(['nl-NL'])).toBe('en');
    expect(pickLocale([])).toBe('en');
  });
});
