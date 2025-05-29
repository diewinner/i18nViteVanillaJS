import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import templateEnginePlugin from "./vite-plugin-template-engine.js";

export default defineConfig({
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      input: 'src/main.js'
    }
  },
  plugins: [
    templateEnginePlugin({
      templatesDir: 'src/templates',
      localesDir: 'src/locales',
      regions: ['ru', 'ua', 'en'],
      languages: ['en', 'ru', 'ua'],
      baseLang: 'ru',
      variables: {
        title: 'My Vite App'
      },
      debug: true
    }),
    {
      name: 'copy-css',
      closeBundle() {
        const srcDir = path.resolve('src/assets');
        const destDir = path.resolve('dist/assets');
        // handle css assets files
        if (!fs.existsSync(srcDir)) {
          return;
        }

        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        const files = fs.readdirSync(srcDir);
        files.forEach(file => {
          if (file.endsWith('.css')) {
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied CSS file: ${file}`);
          }
        });
      }
    }
  ]
});