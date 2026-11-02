// Node 20 compatibility polyfill for Expo SDK 58
if (!URL.parse) {
  URL.parse = (url, base) => {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}

