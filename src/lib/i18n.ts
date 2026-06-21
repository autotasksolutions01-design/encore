import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import resourcesToBackend from "i18next-resources-to-backend";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(
    resourcesToBackend(
      (language: string, namespace: string) =>
        import(`../../public/locales/${language}/${namespace}.json`),
    ),
  )
  .init({
    fallbackLng: "en",
    defaultNS: "common",
    ns: ["common", "auth", "profile", "discover", "messages", "jams"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["cookie", "path", "header"],
      caches: ["cookie"],
      lookupCookie: "NEXT_LOCALE",
      lookupFromPathIndex: 0,
    },
  });

export default i18n;
