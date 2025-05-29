// vite-plugin-template-engine.js
import fs from 'fs';
import path from 'path';

export default function templateEnginePlugin(options = {}) {
  const {
    templatesDir = 'templates',
    variables = {},
    outputPath = '',
    debug = false,
    localesDir = 'src/locales',
    regions = ['ru', 'ua', 'en'],
    languages = ['en', 'ru', 'ua'],
    baseLang = 'ru'
  } = options;

  // Regex patterns for template syntax
  const templateSyntaxRegex = /({[{%][^{}%]*[%}]})/g;
  const blockRegex = /{%\s*block\s+(\w+)\s*%}([\s\S]*?){%\s*endblock\s*%}/g;
  const extendsRegex = /{%\s*extends\s+"([^"]+)"\s*%}/;
  const includeRegex = /{%\s*include\s+"([^"]+)"\s*%}/g;
  const variableRegex = /{{(.*?)}}/g;
  const translationRegex = /{%\s*translations\.get\('([^']+)'\)\s*%}/g;

  const absoluteTemplatesDir = path.resolve(process.cwd(), templatesDir);
  const absoluteLocalesDir = path.resolve(process.cwd(), localesDir);

  // Load translations
  const translations = {};
  for (const lang of languages) {
    const filePath = path.join(absoluteLocalesDir, `${lang}.json`);
    if (fs.existsSync(filePath)) {
      translations[lang] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  }

  // Create reverse dictionary for translations
  const reverseDict = createReverseDictionary(translations[baseLang]);

  if (debug) {
    console.log(`Template engine initialized with directory: ${absoluteTemplatesDir}`);
    console.log('Loaded translations:', Object.keys(translations));
  }

  return {
    name: 'vite-plugin-template-engine',
    // Configure the plugin
    configResolved(config) {
      if (debug) {
        console.log('Vite config resolved');
        console.log('Template files will be processed from:', absoluteTemplatesDir);
      }
    },

    // Scan templates directory at build start
    buildStart() {
      if (debug) {
        console.log(`Scanning templates directory: ${absoluteTemplatesDir}`);
      }
      if (!fs.existsSync(absoluteTemplatesDir)) {
        console.error(`Templates directory not found: ${absoluteTemplatesDir}`);
        return;
      }
      // Process all template files recursively
      scanTemplatesDirectory(absoluteTemplatesDir, this);
    },

    // Mark template files as resolved
    resolveId(id) {
      // Handle .html files in the templates directory
      if (id.startsWith(templatesDir) && id.endsWith('.html')) {
        if (debug) {
          console.log(`Resolved template ID: ${id}`);
        }
        return id; // Mark as resolved so Vite processes it
      }
      return null;
    },

    // Load template files when requested
    load(id) {
      if (id.startsWith(templatesDir) && id.endsWith('.html')) {
        if (debug) {
          console.log(`Loading template file: ${id}`);
        }
        return fs.readFileSync(path.resolve(process.cwd(), id), 'utf-8');
      }
      return null;
    },

    // Handle HTML files and preserve template syntax
    transformIndexHtml: {
      enforce: 'pre',
      transform(html, { filename }) {
        if (debug) {
          console.log(`Processing file: ${filename}`);
        }

        // Process template syntax
        html = html.replace(templateSyntaxRegex, match => {
          return `<!--template:${Buffer.from(match).toString('base64')}-->`;
        });

        return html;
      },
    },
    // Process templates during build
    generateBundle(_, bundle) {
      if (debug) {
        console.log('Processing bundle files for template inheritance...');
        console.log('Bundle contents:', Object.keys(bundle));
      }

      // Create a new bundle for each region and language
      const newBundle = {};

      for (const [filename, file] of Object.entries(bundle)) {
        if (debug) {
          console.log(`Processing file: ${filename}, type: ${file.type}`);
        }

        // Keep all non-HTML files as is
        if (!filename.endsWith('.html')) {
          newBundle[filename] = file;
          continue;
        }

        if (file.type === 'asset' && filename.endsWith('.html')) {
          if (debug) {
            console.log(`Processing HTML asset: ${filename}`);
          }

          // Restore template syntax
          let content = file.source.toString().replace(
            /<!--template:([A-Za-z0-9+/=]+)-->/g,
            (_, encoded) => Buffer.from(encoded, 'base64').toString()
          );

          try {
            // Check if the template has extends tag
            const hasExtends = extendsRegex.test(content);
            const hasTranslations = translationRegex.test(content);

            if (hasTranslations) {
              // Process the template for each region and language
              for (const region of regions) {
                for (const lang of languages) {
                  let processedContent;
                  
                  if (hasExtends || content.includes('{% include')) {
                    // Create a temporary file to process
                    const tempFilename = path.basename(filename);
                    const tempFilePath = path.join(absoluteTemplatesDir, `_temp_${tempFilename}`);
                    fs.writeFileSync(tempFilePath, content);

                    // Process the template
                    processedContent = processTemplate(tempFilePath, absoluteTemplatesDir, {
                      ...variables,
                      lang,
                      region
                    });

                    // Clean up
                    try { fs.unlinkSync(tempFilePath); } catch (e) {}
                  } else {
                    processedContent = content;
                  }

                  // Process translations
                  processedContent = processTranslations(processedContent, lang);

                  // Create new filename for this region and language
                  const newFilename = `${region}-${lang}-${path.basename(filename)}`;
                  newBundle[newFilename] = {
                    type: 'asset',
                    fileName: newFilename,
                    source: processedContent
                  };

                  if (debug) {
                    console.log(`Created file: ${newFilename}`);
                  }
                }
              }
            } else {
              // If no translations, just process the template once
              let processedContent;
              
              if (hasExtends || content.includes('{% include')) {
                // Create a temporary file to process
                const tempFilename = path.basename(filename);
                const tempFilePath = path.join(absoluteTemplatesDir, `_temp_${tempFilename}`);
                fs.writeFileSync(tempFilePath, content);

                // Process the template
                processedContent = processTemplate(tempFilePath, absoluteTemplatesDir, variables);

                // Clean up
                try { fs.unlinkSync(tempFilePath); } catch (e) {}
              } else {
                // Just process variables
                processedContent = content.replace(variableRegex, (match, varName) => {
                  const name = varName.trim();
                  return variables[name] !== undefined ? variables[name] : match;
                });
              }

              // Add to bundle with original filename
              newBundle[filename] = {
                type: 'asset',
                fileName: filename,
                source: processedContent
              };

              if (debug) {
                console.log(`Created file: ${filename}`);
              }
            }
          } catch (error) {
            console.error(`Error processing template ${filename}:`, error);
          }
        }
      }

      // Replace the original bundle with our new one
      Object.assign(bundle, newBundle);
    },
    async generateOutputFiles(bundle) {
      const outputDir = path.resolve(this.config.root, this.config.build.outDir);
      const templatePath = path.resolve(this.config.root, this.config.build.rollupOptions.input);
      const templateContent = await fs.readFile(templatePath, 'utf-8');

      // Get all assets from the bundle
      const assets = Object.entries(bundle).filter(([id]) => {
        return id.endsWith('.js') || id.endsWith('.css');
      });

      for (const [region, lang] of this.regions) {
        const outputPath = path.join(outputDir, region, lang, 'index.html');
        let content = templateContent;

        // Replace template syntax
        content = content.replace(/<!--template:([^>]+)-->/g, (match, encoded) => {
          const template = Buffer.from(encoded, 'base64').toString();
          return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const value = this.translations[region][lang][key.trim()];
            return value !== undefined ? value : match;
          });
        });

        // Update asset paths
        content = content.replace(/\{\{ region \}\}/g, region);
        content = content.replace(/\{\{ lang \}\}/g, lang);

        // Create output directory if it doesn't exist
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        // Write the processed HTML file
        await fs.writeFile(outputPath, content);

        // Copy and rename assets
        for (const [assetId, asset] of assets) {
          const assetName = path.basename(assetId);
          const newAssetName = `${region}-${lang}-${assetName}`;
          const assetPath = path.join(outputDir, newAssetName);
          
          // Write the asset file
          await fs.writeFile(assetPath, asset.code || asset.source);
        }
      }
    },
    closeBundle: async () => {
      if (debug) {
        console.log('Closing bundle...');
      }
    }
  };
  // Scan templates directory and add files to build
  function scanTemplatesDirectory(dir, context) {
    if (!fs.existsSync(dir)) {
      console.error(`Directory not found: ${dir}`);
      return;
    }
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      // Skip temporary files
      if (file.startsWith('_temp_')) {
        continue;
      }
      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        scanTemplatesDirectory(filePath, context);
      } else if (file.endsWith('.html')) {
        // Process HTML template files
        const relativePath = path.relative(process.cwd(), filePath);
        const outputFilePath = path.relative(absoluteTemplatesDir, filePath);
        if (debug) {
          console.log(`Found template file: ${relativePath}`);
          console.log(`Will emit to: ${outputPath ? path.join(outputPath, outputFilePath) : outputFilePath}`);
        }
        // Emit file to be included in the bundle
        context.emitFile({
          type: 'asset',
          fileName: outputPath ? path.join(outputPath, outputFilePath) : outputFilePath,
          source: fs.readFileSync(filePath, 'utf-8')
        });
      }
    }
  }
  // Process a template file with inheritance
  function processTemplate(filePath, basePath, context) {
    if (debug) {
      console.log(`Processing template: ${filePath}`);
    }
    // Resolve template inheritance
    let content = resolveInheritance(filePath, basePath);
    // Process variable substitution
    content = content.replace(variableRegex, (match, varName) => {
      const name = varName.trim();
      return context[name] !== undefined ? context[name] : match;
    });
    // Clean up any remaining template tags
    content = content.replace(/{%\s*block\s+\w+\s*%}|{%\s*endblock\s*%}/g, '');
    content = content.replace(/{%\s*extends\s+"[^"]+"\s*%}/g, '');
    return content;
  }
  // Resolve template inheritance (extends and blocks)
  function resolveInheritance(filePath, basePath) {
    if (debug) {
      console.log(`Resolving inheritance for: ${filePath}`);
    }
    let content = fs.readFileSync(filePath, 'utf-8');
    const extendsMatch = content.match(extendsRegex);
    if (extendsMatch) {
      const parentTemplate = extendsMatch[1];
      const parentPath = path.resolve(basePath, parentTemplate);
      if (debug) {
        console.log(`Found extends directive, parent template: ${parentTemplate}`);
        console.log(`Resolved parent path: ${parentPath}`);
      }
      if (!fs.existsSync(parentPath)) {
        console.error(`Parent template not found: ${parentPath}`);
        return content;
      }
      const parentContent = fs.readFileSync(parentPath, 'utf-8');
      // Extract all blocks from child template
      const childBlocks = {};
      let blockMatch;
      const blockRegexClone = new RegExp(blockRegex); // Create a new regex instance
      while ((blockMatch = blockRegexClone.exec(content)) !== null) {
        const [, blockName, blockContent] = blockMatch;
        childBlocks[blockName] = blockContent.trim();
        if (debug) {
          console.log(`Found child block: ${blockName}`);
        }
      }
      // Replace blocks in parent with blocks from child
      let processedParent = parentContent.replace(blockRegex, (match, blockName, defaultContent) => {
        if (childBlocks[blockName]) {
          if (debug) {
            console.log(`Replacing block ${blockName} in parent template`);
          }
          return `{% block ${blockName} %}${childBlocks[blockName]}{% endblock %}`;
        }
        return match;
      });
      // Process parent inheritance recursively
      if (processedParent.match(extendsRegex)) {
        if (debug) {
          console.log(`Parent template also has extends directive, processing recursively`);
        }
        const tempFilePath = path.join(basePath, `_temp_parent_${Date.now()}.html`);
        fs.writeFileSync(tempFilePath, processedParent);
        processedParent = resolveInheritance(tempFilePath, basePath);
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
      content = processedParent;
    }
    // Process includes
    content = processIncludes(content, basePath);
    return content;
  }
  // Process include statements
  function processIncludes(content, basePath) {
    return content.replace(includeRegex, (match, includeFile) => {
      const includePath = path.resolve(basePath, includeFile);
      if (debug) {
        console.log(`Processing include: ${includeFile}, resolved path: ${includePath}`);
      }
      try {
        if (!fs.existsSync(includePath)) {
          console.error(`Include file not found: ${includePath}`);
          return `<!-- Failed to include ${includeFile} (file not found) -->`;
        }
        const includeContent = fs.readFileSync(includePath, 'utf-8');
        // Process nested includes
        return processIncludes(includeContent, basePath);
      } catch (error) {
        console.error(`Failed to include file ${includeFile}:`, error);
        return `<!-- Failed to include ${includeFile} -->`;
      }
    });
  }
  // Helper functions for translations
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

  function findTranslation(text, reverseDict, translations) {
    const key = reverseDict[text];
    return key ? getNestedValue(translations, key) : text;
  }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((o, p) => o?.[p], obj);
  }

  function processTranslations(content, lang) {
    return content.replace(translationRegex, (match, text) => {
      if (lang === baseLang) {
        return text;
      }
      return findTranslation(text, reverseDict, translations[lang]);
    });
  }
}