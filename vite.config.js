import { defineConfig } from "vite";
import {viteGenerateHtmlI18n} from "vite-plugin-generate-html-i18n";
import en from './src/locales/en.json';
import ru from './src/locales/ru.json';
import ua from './src/locales/ua.json';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    viteGenerateHtmlI18n({
      glob: (outputPath) => `${outputPath}/*.html`,
      translations: {
        en: en,
        ru: ru,
        ua: ua
      },
      selector: "[data-i18n]",
      getTranslationKey: (element) => element.getAttribute("data-i18n"),
      modifyElement: (element, value) => {
        element.innerHTML = value || "";
      },
      modifyDocumentAfter: (document, { language }) => {
        document.documentElement.setAttribute("lang", language);
      },
      deleteSourceHtmlFiles: true,
    }),
  ],
});