import en from './locales/en.json';
import ru from './locales/ru.json';
import ua from './locales/ua.json';

const translations = {
    en: en,
    ru: ru,
    ua: ua,
};

const switcher = document.getElementById('languageSwitcher');

function changeLanguage(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = translations[lang]?.[key] ?? '';
    });
}

switcher.addEventListener('change', e => {
    changeLanguage(e.target.value);
});

changeLanguage(switcher.value || 'ru');