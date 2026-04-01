import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import translationEN from './locales/en/translation.json';
import translationHI from './locales/hi/translation.json';
import translationMR from './locales/mr/translation.json';

// Configure language resources
const resources = {
  en: { translation: translationEN },
  hi: { translation: translationHI },
  mr: { translation: translationMR }
};

i18n
  // Detects user language from browser settings/localStorage
  .use(LanguageDetector)
  // Passes i18n instance to react-i18next
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    
    // Configures the language detector
    detection: {
      order: ['queryString', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie']
    },
    
    interpolation: {
      escapeValue: false // React already escapes by default preventing XSS
    }
  });

export default i18n;
