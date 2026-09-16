const I18N = {
  en: {
    "nav.chat": "Chat",
    "nav.docs": "Documents",
    "nav.settings": "Settings",
    "sidebar.offline": "Offline / on-device",
    "chat.title": "Ask your documents",
    "chat.clear": "Clear",
    "chat.welcome":
      "Hi! Ask me anything about the documents in the knowledge base. " +
      "I only answer from what's actually indexed, and I'll tell you when I don't know.",
    "chat.placeholder": "Ask a question...",
    "chat.ask": "Ask",
    "chat.sourcesLabel": "Retrieved passages",
    "chat.noAnswer": "Something went wrong.",
    "chat.noServer": "Could not reach the server.",
    "docs.title": "Knowledge base",
    "docs.reindex": "Reindex",
    "docs.upload": "Upload",
    "docs.hint":
      "Only .md and .txt files are supported. Uploading or deleting a file automatically rebuilds the index.",
    "docs.chunks": "chunks",
    "docs.delete": "Delete",
    "docs.empty": "No documents indexed yet. Upload one above.",
    "settings.title": "Settings",
    "settings.topk": "Passages retrieved per question (top-k)",
    "settings.showSources": "Show retrieved passages under each answer",
    "settings.theme": "Theme",
    "settings.themeDark": "Dark",
    "settings.themeLight": "Light",
    "settings.language": "Language",
    "settings.backends": "Active backends",
  },
  tr: {
    "nav.chat": "Sohbet",
    "nav.docs": "Belgeler",
    "nav.settings": "Ayarlar",
    "sidebar.offline": "Çevrimdışı / cihaz üzerinde",
    "chat.title": "Belgelerine soru sor",
    "chat.clear": "Temizle",
    "chat.welcome":
      "Merhaba! Bilgi tabanındaki belgelerle ilgili bana istediğini sorabilirsin. " +
      "Sadece gerçekten dizine eklenmiş belgelere göre cevap veririm, bilmediğimde söylerim.",
    "chat.placeholder": "Bir soru yaz...",
    "chat.ask": "Sor",
    "chat.sourcesLabel": "Kullanılan pasajlar",
    "chat.noAnswer": "Bir şeyler ters gitti.",
    "chat.noServer": "Sunucuya ulaşılamadı.",
    "docs.title": "Bilgi tabanı",
    "docs.reindex": "Yeniden indeksle",
    "docs.upload": "Yükle",
    "docs.hint":
      "Sadece .md ve .txt dosyaları desteklenir. Bir dosya yükleyip silmek indeksi otomatik olarak yeniden oluşturur.",
    "docs.chunks": "parça",
    "docs.delete": "Sil",
    "docs.empty": "Henüz belge yok. Yukarıdan bir tane yükle.",
    "settings.title": "Ayarlar",
    "settings.topk": "Soru başına getirilecek pasaj sayısı (top-k)",
    "settings.showSources": "Her cevabın altında kullanılan pasajları göster",
    "settings.theme": "Tema",
    "settings.themeDark": "Koyu",
    "settings.themeLight": "Açık",
    "settings.language": "Dil",
    "settings.backends": "Aktif motorlar",
  },
};

function applyI18n(lang) {
  const dict = I18N[lang] || I18N.en;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) el.setAttribute("placeholder", dict[key]);
  });
  document.documentElement.lang = lang;
}

function t(lang, key) {
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}
