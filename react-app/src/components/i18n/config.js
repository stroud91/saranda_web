import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

i18n
  .use(initReactI18next) // Passes i18n down to react-i18next
  .use(LanguageDetector) // Detects language from the browser
  .use(HttpBackend) // Loads translations from your server
  .init({
    fallbackLng: 'en',
    debug: true,
    detection: {
      order: ['queryString', 'cookie'],
      cache: ['cookie']
    },
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
  });

export default i18n;
