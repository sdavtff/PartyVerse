/** Rodando dentro do app Android (Capacitor acrescenta "PartyVerseApp" ao user agent). */
export const isNativeApp = () =>
  typeof navigator !== 'undefined' && navigator.userAgent.includes('PartyVerseApp');

/** Link do APK mais recente (publicado pelo GitHub Actions). */
export const APK_URL =
  'https://github.com/sdavtff/PartyVerse/releases/latest/download/PartyVerse.apk';

export const isAndroid = () =>
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
