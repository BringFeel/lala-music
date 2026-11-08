import en from './en.js';
import es from './es.js';

const dictionaries = { en, es };
const DEFAULT_LANGUAGE = 'es';

let language = DEFAULT_LANGUAGE;

export function normalizeLanguage(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized.startsWith('en') ? 'en' : DEFAULT_LANGUAGE;
}

export function setLanguage(value) {
  language = normalizeLanguage(value);
  return language;
}

export function getLanguage() {
  return language;
}

export function t(key, params = {}) {
  const template = dictionaries[language]?.[key]
    ?? dictionaries[DEFAULT_LANGUAGE][key]
    ?? key;

  return String(template).replace(/\{(\w+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ));
}

export function tPlural(baseKey, count, params = {}) {
  const suffix = count === 1 ? 'one' : 'other';
  return t(`${baseKey}.${suffix}`, { count, ...params });
}
