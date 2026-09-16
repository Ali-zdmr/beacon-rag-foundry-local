const I18N = {
  en: {
    "nav.chat": "Chat",
    "nav.docs": "Documents",
    "nav.settings": "Settings",
    "nav.about": "About",
    "sidebar.offline": "Offline / on-device",
    "chat.title": "Ask your documents",
    "chat.clear": "Clear",
    "chat.export": "Export",
    "chat.welcome":
      "Hi! Ask me anything about the documents in the knowledge base. " +
      "I only answer from what's actually indexed, and I'll tell you when I don't know.",
    "chat.placeholder": "Ask a question...",
    "chat.ask": "Ask",
    "chat.sourcesLabel": "Retrieved passages",
    "chat.noAnswer": "Something went wrong.",
    "chat.noServer": "Could not reach the server.",
    "chat.thinking": "Thinking...",
    "chat.copy": "Copy",
    "chat.copied": "Copied!",
    "docs.title": "Knowledge base",
    "docs.reindex": "Reindex",
    "docs.upload": "Upload",
    "docs.hint":
      "Only .md and .txt files are supported. Uploading or deleting a file automatically rebuilds the index.",
    "docs.search": "Filter documents...",
    "docs.chunks": "chunks",
    "docs.delete": "Delete",
    "docs.preview": "Preview",
    "docs.empty": "No documents indexed yet. Upload one above.",
    "docs.noMatch": "No documents match your filter.",
    "docs.statsTotal": "documents",
    "docs.statsChunks": "chunks",
    "docs.statsAvg": "avg. chunks / doc",
    "settings.title": "Settings",
    "settings.topk": "Passages retrieved per question (top-k)",
    "settings.showSources": "Show retrieved passages under each answer",
    "settings.theme": "Theme",
    "settings.themeDark": "Dark",
    "settings.themeLight": "Light",
    "settings.language": "Language",
    "settings.backends": "Active backends",
    "settings.pipeline": "Pipeline configuration",
    "about.title": "How Beacon works",
    "about.intro":
      "Beacon never answers from memory - every answer is grounded in the documents " +
      "you've indexed. Here's the pipeline behind each question:",
    "about.step1Title": "1. Chunking",
    "about.step1Desc": "Documents are split into overlapping paragraph-sized passages.",
    "about.step2Title": "2. Embedding",
    "about.step2Desc": "Each passage becomes a numeric vector capturing its meaning.",
    "about.step3Title": "3. SQLite",
    "about.step3Desc": "Passages and vectors are stored locally in a single database file.",
    "about.step4Title": "4. Retrieval",
    "about.step4Desc": "Your question is compared against every vector to find the closest matches.",
    "about.step5Title": "5. Generation",
    "about.step5Desc": "A local model answers using only the retrieved passages as context.",
    "about.stackTitle": "Built with",
    "about.stackDesc":
      "Python, SQLite, Flask, numpy - and Microsoft Foundry Local for on-device " +
      "inference when it's installed (with an offline fallback when it isn't).",
  },
  tr: {
    "nav.chat": "Sohbet",
    "nav.docs": "Belgeler",
    "nav.settings": "Ayarlar",
    "nav.about": "Hakkında",
    "sidebar.offline": "Çevrimdışı / cihaz üzerinde",
    "chat.title": "Belgelerine soru sor",
    "chat.clear": "Temizle",
    "chat.export": "Dışa aktar",
    "chat.welcome":
      "Merhaba! Bilgi tabanındaki belgelerle ilgili bana istediğini sorabilirsin. " +
      "Sadece gerçekten dizine eklenmiş belgelere göre cevap veririm, bilmediğimde söylerim.",
    "chat.placeholder": "Bir soru yaz...",
    "chat.ask": "Sor",
    "chat.sourcesLabel": "Kullanılan pasajlar",
    "chat.noAnswer": "Bir şeyler ters gitti.",
    "chat.noServer": "Sunucuya ulaşılamadı.",
    "chat.thinking": "Düşünüyor...",
    "chat.copy": "Kopyala",
    "chat.copied": "Kopyalandı!",
    "docs.title": "Bilgi tabanı",
    "docs.reindex": "Yeniden indeksle",
    "docs.upload": "Yükle",
    "docs.hint":
      "Sadece .md ve .txt dosyaları desteklenir. Bir dosya yükleyip silmek indeksi otomatik olarak yeniden oluşturur.",
    "docs.search": "Belgelerde filtrele...",
    "docs.chunks": "parça",
    "docs.delete": "Sil",
    "docs.preview": "Önizle",
    "docs.empty": "Henüz belge yok. Yukarıdan bir tane yükle.",
    "docs.noMatch": "Filtreyle eşleşen belge yok.",
    "docs.statsTotal": "belge",
    "docs.statsChunks": "parça",
    "docs.statsAvg": "ort. parça/belge",
    "settings.title": "Ayarlar",
    "settings.topk": "Soru başına getirilecek pasaj sayısı (top-k)",
    "settings.showSources": "Her cevabın altında kullanılan pasajları göster",
    "settings.theme": "Tema",
    "settings.themeDark": "Koyu",
    "settings.themeLight": "Açık",
    "settings.language": "Dil",
    "settings.backends": "Aktif motorlar",
    "settings.pipeline": "Boru hattı yapılandırması",
    "about.title": "Beacon nasıl çalışır",
    "about.intro":
      "Beacon hiçbir zaman hafızasından cevap vermez - her cevap, indekslediğin belgelere " +
      "dayanır. İşte her sorunun arkasındaki adımlar:",
    "about.step1Title": "1. Parçalama",
    "about.step1Desc": "Belgeler, üst üste binen paragraf büyüklüğünde parçalara bölünür.",
    "about.step2Title": "2. Embedding",
    "about.step2Desc": "Her parça, anlamını yakalayan sayısal bir vektöre dönüştürülür.",
    "about.step3Title": "3. SQLite",
    "about.step3Desc": "Parçalar ve vektörler tek bir veritabanı dosyasında yerel olarak saklanır.",
    "about.step4Title": "4. Getirme (Retrieval)",
    "about.step4Desc": "Sorun, en yakın eşleşmeleri bulmak için tüm vektörlerle karşılaştırılır.",
    "about.step5Title": "5. Üretim (Generation)",
    "about.step5Desc": "Yerel bir model, sadece getirilen parçaları bağlam olarak kullanarak cevap verir.",
    "about.stackTitle": "Kullanılan teknolojiler",
    "about.stackDesc":
      "Python, SQLite, Flask, numpy - ve kuruluysa cihaz üzerinde çıkarım için Microsoft " +
      "Foundry Local (kurulu değilse çevrimdışı yedek moda geçer).",
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
