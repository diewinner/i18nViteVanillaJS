import { defineConfig } from 'vite';
import { createMpaPlugin } from 'vite-plugin-virtual-mpa';
import fs from 'fs';
import path from 'path';

const config = {
  baseLang: 'ru', // Базовый язык для ключей
  regions: ['ru', 'ua', 'en'],
  languages: ['en', 'ru', 'ua'],
  pagesDir: 'src/pages',
  localesDir: 'src/locales'
};

function generatePages() {
  const pages = [];
  const templates = fs.readdirSync(config.pagesDir)
    .filter(file => file.endsWith('.html'))
    .map(file => path.basename(file, '.html'));

  // Загружаем базовый словарь
  const baseTranslations = JSON.parse(
    fs.readFileSync(path.join(config.localesDir, `${config.baseLang}.json`), 'utf-8')
  );

  // Создаем обратный словарь значение -> ключ
  const reverseDict = createReverseDictionary(baseTranslations);

  for (const region of config.regions) {
    for (const lang of config.languages) {
      const currentTranslations = JSON.parse(
        fs.readFileSync(path.join(config.localesDir, `${lang}.json`), 'utf-8')
      );

      for (const template of templates) {
        pages.push({
          name: `${region}-${lang}-${template}`,
          filename: `${region}-${lang}-${template}.html`,
          template: path.join(config.pagesDir, `${template}.html`),
          data: {
            lang,
            region,
            translations: processTemplate(baseTranslations, currentTranslations, reverseDict, lang)
          }
        });
      }
    }
  }
  return pages;
}

function createReverseDictionary(translations) {
  const dict = {};
  const walk = (obj, path = []) => {
    for (const key in obj) {
      const currentPath = [...path, key];
      if (typeof obj[key] === 'object') {
        walk(obj[key], currentPath);
      } else {
        dict[obj[key]] = currentPath.join('.');
      }
    }
  };
  walk(translations);
  return dict;
}

function processTemplate(baseTranslations, currentTranslations, reverseDict, lang) {
  return {
    // Для базового языка вставляем значения напрямую
    get: (text) => lang === config.baseLang
      ? text
      : findTranslation(text, reverseDict, currentTranslations),

    // Для селектора
    switcher: Object.entries(baseTranslations.buttons.switcher).map(([code, value]) => ({
      code,
      text: lang === config.baseLang ? value : currentTranslations.buttons.switcher[code]
    }))
  };
}

function findTranslation(text, reverseDict, translations) {
  const key = reverseDict[text];
  return key ? getNestedValue(translations, key) : text;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, p) => o?.[p], obj);
}

export default defineConfig({
  plugins: [
    createMpaPlugin({
      pages: generatePages(),
      template: 'src/template.html',
      preprocessor: 'ejs'
    })
  ]
});