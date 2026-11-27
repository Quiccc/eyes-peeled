import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Daily } from '@shared/types';

import { submissions, words } from '../src/db/schema';
import { localeFromHeader, matchLocale } from '../src/i18n/locale';
import { SUBMISSION_MESSAGES, isTranslated, translate } from '../src/i18n/messages';
import { wordName } from '../src/lib/words';
import { WORD_POOL } from '../src/seed/words';
import { seedTranslations } from '../src/seed/word-translations';
import { seedWords } from '../src/seed/words';
import { jpeg, startTestServer, type TestServer } from './helpers';

describe('locale matching', () => {
  it('matches on the language, falling back to the closest supported variant', () => {
    expect(matchLocale('es-MX')).toBe('es');
    expect(matchLocale('pt-PT')).toBe('pt-BR');
    expect(matchLocale('zh-Hant-TW')).toBe('zh-Hans');
    expect(matchLocale('in')).toBe('id');
    expect(matchLocale('TR')).toBe('tr');
    expect(matchLocale('xx')).toBeNull();
  });

  it('picks the highest-weighted supported language from Accept-Language', () => {
    expect(localeFromHeader(undefined)).toBe('en');
    expect(localeFromHeader('')).toBe('en');
    expect(localeFromHeader('ja')).toBe('ja');
    expect(localeFromHeader('xx-YY,de;q=0.8,en;q=0.9')).toBe('en');
    expect(localeFromHeader('nl;q=1, fr;q=0.5')).toBe('fr');
    expect(localeFromHeader('ko;q=0, *')).toBe('en');
  });
});

describe('translate', () => {
  it('translates known messages and fills placeholders', () => {
    expect(translate("You can't add yourself.", undefined, 'de')).toBe('Du kannst dich nicht selbst hinzufügen.');
    expect(translate('That\'s {n} tries for this word today. New words arrive at midnight UTC!', { n: 10 }, 'en')).toMatch(
      /^That's 10 tries/,
    );
    expect(translate(SUBMISSION_MESSAGES.not_spotted, { word: 'Stuhl' }, 'de')).toContain('„Stuhl“');
  });

  it('leaves unknown messages in English', () => {
    expect(translate('Some admin-only problem.', undefined, 'ja')).toBe('Some admin-only problem.');
  });

  it('has every submission message translated', () => {
    for (const english of Object.values(SUBMISSION_MESSAGES)) expect(isTranslated(english)).toBe(true);
  });
});

describe('word names', () => {
  it('uses the translation, or the English label when there is none', () => {
    const word = { label: 'chair', translations: { es: 'silla', fr: '  ' } };
    expect(wordName(word, 'es')).toBe('silla');
    expect(wordName(word, 'fr')).toBe('chair');
    expect(wordName(word, 'de')).toBe('chair');
    expect(wordName(word, 'en')).toBe('chair');
  });

  it('has seed translations for every pool word', () => {
    for (const label of Object.values(WORD_POOL).flat()) {
      expect(Object.keys(seedTranslations(label)), label).toHaveLength(12);
    }
  });
});

describe('localized API', () => {
  let t: TestServer;
  beforeEach(async () => {
    t = await startTestServer();
  });
  afterEach(() => t.close());

  const daily = async (auth: Record<string, string>, lang?: string) => {
    const req = t.http().get('/daily').set(auth);
    if (lang) req.set('Accept-Language', lang);
    return (await req).body as Daily;
  };

  it('sends the words in the requested language and Claude the English label', async () => {
    const a = await t.signIn('alex');
    const en = await daily(a.auth);
    const es = await daily(a.auth, 'es-ES,es;q=0.9');
    const [enEasy] = await t.ctx.db.select().from(words).where(eq(words.label, en.words[0]!.word));
    expect(es.words[0]!.word).toBe(enEasy!.translations.es);
    expect(es.words[0]!.word).not.toBe(en.words[0]!.word);

    const seen: string[] = [];
    t.setVerdict((label) => {
      seen.push(label);
      return { detected: false, confidence: 0.1 };
    });
    const miss = await t
      .http()
      .post(`/words/${es.words[0]!.id}/submissions`)
      .set(a.auth)
      .set('Accept-Language', 'es')
      .attach('photo', jpeg(), 'p.jpg');
    expect(seen).toEqual([en.words[0]!.word]);
    expect(miss.body.message).toBe(
      translate(SUBMISSION_MESSAGES.not_spotted, { word: es.words[0]!.word }, 'es'),
    );

    // The same stored verdict reads in English for an English request.
    const again = await t.http().get(`/submissions/${miss.body.id}`).set(a.auth);
    expect(again.body.message).toBe(`We couldn't spot a ${en.words[0]!.word}. Get closer and make sure it's in focus.`);
    // English is stored for the logs and the admin panel.
    const [row] = await t.ctx.db.select().from(submissions).where(eq(submissions.id, miss.body.id));
    expect(row).toMatchObject({ messageCode: 'not_spotted', message: again.body.message });
  });

  it('translates messages stored before message codes when it knows them', async () => {
    const a = await t.signIn('alex');
    const word = (await daily(a.auth)).words[0]!;
    t.setVerdict({ detected: false, confidence: 0.1 });
    const res = await t.http().post(`/words/${word.id}/submissions`).set(a.auth).attach('photo', jpeg(), 'p.jpg');
    await t.ctx.db
      .update(submissions)
      .set({ messageCode: null, message: 'You already found this one today.' })
      .where(eq(submissions.id, res.body.id));
    const fr = await t.http().get(`/submissions/${res.body.id}`).set(a.auth).set('Accept-Language', 'fr');
    expect(fr.body.message).toBe("Tu l'as déjà trouvé aujourd'hui.");
  });

  it('translates error messages and says which language it answered in', async () => {
    const a = await t.signIn('alex');
    const res = await t.http().post('/friends/requests').set(a.auth).set('Accept-Language', 'tr').send({ userId: a.id });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Kendini ekleyemezsin.');
    expect(res.headers['content-language']).toBe('tr');
    const zod = await t.http().post('/friends/requests').set(a.auth).set('Accept-Language', 'tr').send({});
    expect(zod.body.message).toBe('Geçersiz istek.');
    const missing = await t.http().get('/nope').set('Accept-Language', 'ja');
    expect(missing.body).toEqual({ code: 'not_found', message: '見つかりませんでした。' });
  });

  it('keeps admin-corrected translations when seeding again', async () => {
    await t.ctx.db.update(words).set({ translations: { es: 'silla de oficina' } }).where(eq(words.label, 'chair'));
    await seedWords(t.ctx.db);
    const [chair] = await t.ctx.db.select().from(words).where(eq(words.label, 'chair'));
    expect(chair!.translations.es).toBe('silla de oficina');
    expect(chair!.translations.de).toBe('Stuhl');
  });
});
