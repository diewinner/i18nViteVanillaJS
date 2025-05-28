// vite-plugin-template-engine.js
import fs from 'fs';
import path from 'path';
import ejs from 'ejs';

export default function templateEnginePlugin(options = {}) {
  const {
    templatesDir = 'templates',
    variables = {},
    outputPath = '',
    debug = false,
  } = options;

  const absoluteTemplatesDir = path.resolve(process.cwd(), templatesDir);

  if (debug) {
    console.log(`Template engine initialized with directory: ${absoluteTemplatesDir}`);
  }

  return {
    name: 'vite-plugin-template-engine',

    configResolved(config) {
      if (debug) {
        console.log('Vite config resolved');
        console.log('Template files will be processed from:', absoluteTemplatesDir);
      }
    },

    buildStart() {
      if (debug) {
        console.log(`Scanning templates directory: ${absoluteTemplatesDir}`);
      }

      if (!fs.existsSync(absoluteTemplatesDir)) {
        console.error(`Templates directory not found: ${absoluteTemplatesDir}`);
        return;
      }

      scanTemplatesDirectory(absoluteTemplatesDir, this);
    },

    resolveId(id) {
      if (!id || typeof id !== 'string') return null;
      
      const normalizedId = id.replace(/\\/g, '/');
      if (normalizedId.startsWith(templatesDir) && normalizedId.endsWith('.html')) {
        if (debug) {
          console.log(`Resolved template ID: ${normalizedId}`);
        }
        return normalizedId;
      }
      return null;
    },

    load(id) {
      if (!id || typeof id !== 'string') return null;
      
      const normalizedId = id.replace(/\\/g, '/');
      if (normalizedId.startsWith(templatesDir) && normalizedId.endsWith('.html')) {
        if (debug) {
          console.log(`Loading template file: ${normalizedId}`);
        }
        const filePath = path.resolve(process.cwd(), normalizedId);
        if (fs.existsSync(filePath)) {
          return fs.readFileSync(filePath, 'utf-8');
        }
      }
      return null;
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html, { filename }) {
        if (debug) {
          console.log(`Processing file: ${filename}`);
        }

        try {
          // Process EJS includes
          html = html.replace(/<%-?\s*include\s*\(['"]([^'"]+)['"]\)\s*%>/g, (match, includePath) => {
            const fullPath = path.resolve(absoluteTemplatesDir, includePath);
            if (fs.existsSync(fullPath)) {
              return fs.readFileSync(fullPath, 'utf-8');
            }
            console.error(`Include file not found: ${fullPath}`);
            return '';
          });

          // Process variables
          html = ejs.render(html, variables, {
            filename,
            async: false
          });

          return html;
        } catch (error) {
          console.error(`Error processing template ${filename}:`, error);
          return html;
        }
      },
    },

    generateBundle(_, bundle) {
      if (debug) {
        console.log('Processing bundle files for template inheritance...');
      }

      for (const [filename, file] of Object.entries(bundle)) {
        if (file.type === 'asset' && filename.endsWith('.html')) {
          if (debug) {
            console.log(`Processing HTML asset: ${filename}`);
          }

          try {
            let content = file.source.toString();

            // Process EJS includes
            content = content.replace(/<%-?\s*include\s*\(['"]([^'"]+)['"]\)\s*%>/g, (match, includePath) => {
              const fullPath = path.resolve(absoluteTemplatesDir, includePath);
              if (fs.existsSync(fullPath)) {
                return fs.readFileSync(fullPath, 'utf-8');
              }
              console.error(`Include file not found: ${fullPath}`);
              return '';
            });

            // Process variables
            content = ejs.render(content, variables, {
              filename,
              async: false
            });

            file.source = content;

            if (debug) {
              console.log(`Finished processing ${filename}`);
            }
          } catch (error) {
            console.error(`Error processing template ${filename}:`, error);
          }
        }
      }
    }
  };

  function scanTemplatesDirectory(dir, context) {
    if (!fs.existsSync(dir)) {
      console.error(`Directory not found: ${dir}`);
      return;
    }

    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        scanTemplatesDirectory(filePath, context);
      } else if (file.endsWith('.html')) {
        const relativePath = path.relative(process.cwd(), filePath);
        const outputFilePath = path.relative(absoluteTemplatesDir, filePath);

        if (debug) {
          console.log(`Found template file: ${relativePath}`);
          console.log(`Will emit to: ${outputPath ? path.join(outputPath, outputFilePath) : outputFilePath}`);
        }

        context.emitFile({
          type: 'asset',
          fileName: outputPath ? path.join(outputPath, outputFilePath) : outputFilePath,
          source: fs.readFileSync(filePath, 'utf-8')
        });
      }
    }
  }
}