import i18next from "i18next";
import { initReactI18next } from "react-i18next/initReactI18next";
import common_es from "@/../public/locales/es/common.json";
import common_en from "@/../public/locales/en/common.json";

const resources = {
  es: { common: common_es },
  en: { common: common_en },
};

export async function getServerI18n(locale: string) {
  const i18n = i18next.createInstance();
  await i18n.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: "en",
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
  return i18n;
}
