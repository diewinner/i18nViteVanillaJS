import { defineConfig } from "vite";
import { viteGenerateHtmlI18n } from "vite-plugin-generate-html-i18n";
import en from './src/locales/en.json';
import ru from './src/locales/ru.json';
import ua from './src/locales/ua.json';
import { createMpaPlugin } from "vite-plugin-virtual-mpa";

const regionMap = {
  ru: ['ru', 'en'],
  ua: ['ua', 'en'],
  en: ['en', 'ru', 'ua']
};

function generatePages() {
  const pages = [];
  const templates = ['index', 'service'];

  Object.entries(regionMap).forEach(([region, langs]) => {
    langs.forEach(lang => {
      templates.forEach(template => {
        pages.push({
          name: `${region}-${lang}-${template}`,
          template: `${template}.html`,
          data: { lang, region },
          filename: `${region}/${lang}/${region}-${lang}-${template}.html`,
          entries: {
            [template]: `src/main.js`
          }
        });
      });
    });
  });

  return pages;
}

export default defineConfig({
  plugins: [
    createMpaPlugin({
      template: 'public',
      pages: generatePages(),
      historyApiFallback: {
        rewrites: [
          { from: /\/ru\/en\//, to: '/ru/en/index.html' },
          { from: /\/ua\/en\//, to: '/ua/en/index.html' },
        ]
      }
    }),
    viteGenerateHtmlI18n({
      glob: (outputPath) => `${outputPath}/**/*.html`,
      translations: { en, ru, ua },
      selector: "[data-i18n]",
      getTranslationKey: (element) => element.getAttribute("data-i18n"),
      modifyElement: (element, value) => {
        element.innerHTML = value || "";
      },
      modifyDocumentAfter: (document, { language }) => {
        document.documentElement.setAttribute("lang", language);
        const switcher = document.getElementById('languageSwitcher');
        if (switcher) switcher.value = language;
      },
      deleteSourceHtmlFiles: true,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const regex = /(ru|ua|en)\/(ru|ua|en)\//;
          const match = assetInfo.name.match(regex);
          return match
            ? `${match[1]}/${match[2]}/assets/[name]-[hash][extname]`
            : 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: (chunkInfo) => {
          const regex = /(ru|ua|en)\/(ru|ua|en)\//;
          const match = chunkInfo.facadeModuleId.match(regex);
          return match
            ? `${match[1]}/${match[2]}/[name]-[hash].js`
            : '[name]-[hash].js';
        }
      }
    }
  }
});