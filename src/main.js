class I18nManager {
  constructor() {
    this.baseTexts = new Set();
    this.translations = {};
    this.currentLang = document.documentElement.lang;
    this.init();
  }

  async init() {
    this.collectTexts();
    await this.loadLanguageData();
    this.setupSwitcher();
  }

  collectTexts() {
    document.querySelectorAll('[data-text]').forEach(el => {
      this.baseTexts.add(el.dataset.text);
    });
  }

  async loadLanguageData() {
    const [baseData, langData] = await Promise.all([
      fetch(`/locales/ru.json`).then(r => r.json()),
      fetch(`/locales/${this.currentLang}.json`).then(r => r.json())
    ]);

    this.reverseDict = this.createReverseDictionary(baseData);
    this.translations = langData;
  }

  createReverseDictionary(translations) {
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

  setupSwitcher() {
    document.getElementById('languageSwitcher').addEventListener('change', async (e) => {
      this.currentLang = e.target.value;
      await this.loadLanguageData();
      this.applyTranslations();
    });
  }

  applyTranslations() {
    document.querySelectorAll('[data-text]').forEach(el => {
      const baseText = el.dataset.text;
      const key = this.reverseDict[baseText];
      el.textContent = key ? this.getNestedValue(key) : baseText;
    });
  }

  getNestedValue(path) {
    return path.split('.').reduce((o, p) => o?.[p], this.translations);
  }
}

new I18nManager();