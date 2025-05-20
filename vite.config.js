import { defineConfig } from 'vite';
import { createMpaPlugin } from 'vite-plugin-virtual-mpa';
import fs from 'fs';
import path from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const config = {
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

  for (const region of config.regions) {
    for (const lang of config.languages) {
      const translations = JSON.parse(
        fs.readFileSync(
          path.join(config.localesDir, `${lang}.json`),
          'utf-8'
        )
      );

      for (const template of templates) {
        pages.push({
          name: `${region}-${lang}-${template}`,
          filename: `${region}-${lang}-${template}.html`,
          template: path.join(config.pagesDir, `${template}.html`),
          data: { // Данные в хтмл
            lang: lang,
            region: region,
            translations: translations
          }
        });
      }
    }
  }
  return pages;
}

export default defineConfig({
  plugins: [
    createMpaPlugin({
      pages: generatePages(),
      template: 'src/template.html',
      preprocessor: 'ejs'
    }),
    viteStaticCopy({
      targets: [
        {
          src: 'src/assets/*.{css,js}',
          dest: 'assets'
        }
      ]
    })
  ],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',

        // обработка css файлов
        assetFileNames: (assetInfo) => {
          if(assetInfo.name.endsWith('.css')) {
            return 'assets/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  }
});