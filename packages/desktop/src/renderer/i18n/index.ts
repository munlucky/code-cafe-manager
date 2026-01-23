/**
 * i18n Configuration
 * 다국어 지원을 위한 i18next 설정
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 번역 리소스 import
import ko from './locales/ko.json';
import en from './locales/en.json';

const resources = {
  ko: { translation: ko },
  en: { translation: en },
};

i18n
  .use(LanguageDetector) // 브라우저 언어 자동 감지
  .use(initReactI18next) // React i18next 바인딩
  .init({
    resources,
    fallbackLng: 'ko', // 기본 언어: 한국어
    lng: undefined, // undefined로 설정하여 LanguageDetector에 맡김

    interpolation: {
      escapeValue: false, // React는 이미 XSS를 방지하므로 불필요
    },

    detection: {
      order: ['navigator', 'htmlTag'],
      caches: [], // 캐시하지 않음 (언어 변경 즉시 반영)
    },
  });

export default i18n;
