/**
 * Minimal i18n layer for Tahajjud+.
 *
 * Why minimal? A real i18next setup is overkill for this app's needs and adds
 * 120KB+ to the bundle. We just need:
 *   - A `t(key)` function that returns the translated string for the current locale
 *   - Locale detection (auto from device + Settings override)
 *   - A few hundred key strings translated
 *
 * Translations are bundled inline per-locale; missing keys fall back to English.
 *
 * Supported locales (build 22 onwards):
 *   en — English (base)
 *   ar — Arabic (full RTL handled separately via utils/rtl)
 *   ur — Urdu (RTL)
 *
 * Adding more is just: drop another locale object below + add to LOCALES.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { DeviceEventEmitter } from 'react-native';

export type Locale =
    | 'en'  // English
    | 'ar'  // Arabic (RTL)
    | 'ur'  // Urdu (RTL)
    | 'tr'  // Turkish
    | 'id'  // Indonesian
    | 'ms'  // Malay
    | 'bn'  // Bengali
    | 'fr'  // French
    | 'fa'  // Persian / Farsi (RTL)
    | 'hi'  // Hindi
    | 'ru'  // Russian
    | 'bs'  // Bosnian
    | 'es'  // Spanish
    | 'de'  // German
    | 'sq'; // Albanian

const LOCALE_KEY = 'app_locale_v1';

// ── Translation dictionaries ───────────────────────────────────────────
// Keys use dot notation for grouping. English is the source of truth —
// adding a new key here requires updating every locale (or it falls back).

type Dict = Record<string, string>;

const en: Dict = {
    // Tab bar
    'tab.home': 'Home',
    'tab.guide': 'Guide',
    'tab.duas': 'Duas',
    'tab.quran': 'Quran',
    'tab.prayers': 'Prayers',

    // Prayer names
    'prayer.fajr': 'Fajr',
    'prayer.dhuhr': 'Dhuhr',
    'prayer.asr': 'Asr',
    'prayer.maghrib': 'Maghrib',
    'prayer.isha': 'Isha',
    'prayer.tahajjud': 'Tahajjud',
    'prayer.sunrise': 'Sunrise',

    // Home
    'home.greeting': 'Assalamu Alaikum,',
    'home.tonightsJourney': "Tonight's Journey",
    'home.enterSilent': 'Enter the Silent Hour',
    'home.gateOpen': 'Gate is Open',
    'home.gateClosed': 'Gate is Closed',
    'home.gateOpens': 'Gate Opens {time}',
    'home.calculating': 'Calculating…',
    'home.lastThirdBegins': 'LAST THIRD BEGINS',

    // Common buttons
    'btn.cancel': 'Cancel',
    'btn.save': 'Save',
    'btn.done': 'Done',
    'btn.continue': 'Continue',
    'btn.skip': 'Skip',
    'btn.share': 'Share',
    'btn.delete': 'Delete',
    'btn.confirm': 'Confirm',
    'btn.close': 'Close',
    'btn.ok': 'OK',

    // Settings sections
    'settings.title': 'Settings',
    'settings.prayerMethod': 'Prayer Time Calculation Method',
    'settings.reciter': 'Quran Reciter',
    'settings.sleepIntel': 'Sleep Intelligence',
    'settings.notifications': 'Notifications',
    'settings.appearance': 'Appearance',
    'settings.privacy': 'Privacy',
    'settings.subscription': 'Subscription',
    'settings.about': 'About',
    'settings.profile': 'Profile',
    'settings.homeScreen': 'Home Screen',

    // Dua Wall
    'duaWall.title': 'Dua Wall',
    'duaWall.quietTonight': 'Quiet tonight · universal duas below',
    'duaWall.ameen': 'Ameen',
    'duaWall.prayFor': 'Pray for',
    'duaWall.praying': 'Praying',
    'duaWall.share': 'Share your dua',

    // Errors & generic
    'error.generic': 'Something went wrong. Please try again.',
    'error.network': 'No internet connection.',
    'error.locationDenied': 'Location access is needed for prayer times.',
};

const ar: Dict = {
    'tab.home': 'الرئيسية',
    'tab.guide': 'دليل',
    'tab.duas': 'الأدعية',
    'tab.quran': 'القرآن',
    'tab.prayers': 'الصلوات',

    'prayer.fajr': 'الفجر',
    'prayer.dhuhr': 'الظهر',
    'prayer.asr': 'العصر',
    'prayer.maghrib': 'المغرب',
    'prayer.isha': 'العشاء',
    'prayer.tahajjud': 'التهجد',
    'prayer.sunrise': 'الشروق',

    'home.greeting': 'السلام عليكم،',
    'home.tonightsJourney': 'رحلة الليلة',
    'home.enterSilent': 'ادخل ساعة الصمت',
    'home.gateOpen': 'الباب مفتوح',
    'home.gateClosed': 'الباب مغلق',
    'home.gateOpens': 'يفتح الباب {time}',
    'home.calculating': 'جارٍ الحساب…',
    'home.lastThirdBegins': 'يبدأ الثلث الأخير',

    'btn.cancel': 'إلغاء',
    'btn.save': 'حفظ',
    'btn.done': 'تم',
    'btn.continue': 'متابعة',
    'btn.skip': 'تخطي',
    'btn.share': 'مشاركة',
    'btn.delete': 'حذف',
    'btn.confirm': 'تأكيد',
    'btn.close': 'إغلاق',
    'btn.ok': 'موافق',

    'settings.title': 'الإعدادات',
    'settings.prayerMethod': 'طريقة حساب أوقات الصلاة',
    'settings.reciter': 'القارئ',
    'settings.sleepIntel': 'ذكاء النوم',
    'settings.notifications': 'الإشعارات',
    'settings.appearance': 'المظهر',
    'settings.privacy': 'الخصوصية',
    'settings.subscription': 'الاشتراك',
    'settings.about': 'حول التطبيق',
    'settings.profile': 'الملف الشخصي',
    'settings.homeScreen': 'الشاشة الرئيسية',

    'duaWall.title': 'جدار الأدعية',
    'duaWall.quietTonight': 'الليلة هادئة · أدعية عامة في الأسفل',
    'duaWall.ameen': 'آمين',
    'duaWall.prayFor': 'ادعُ له',
    'duaWall.praying': 'أدعو',
    'duaWall.share': 'شارك دعاءك',

    'error.generic': 'حدث خطأ. حاول مرة أخرى.',
    'error.network': 'لا يوجد اتصال بالإنترنت.',
    'error.locationDenied': 'يحتاج التطبيق إلى الموقع لحساب أوقات الصلاة.',
};

const ur: Dict = {
    'tab.home': 'ہوم',
    'tab.guide': 'رہنمائی',
    'tab.duas': 'دعائیں',
    'tab.quran': 'قرآن',
    'tab.prayers': 'نمازیں',

    'prayer.fajr': 'فجر',
    'prayer.dhuhr': 'ظہر',
    'prayer.asr': 'عصر',
    'prayer.maghrib': 'مغرب',
    'prayer.isha': 'عشاء',
    'prayer.tahajjud': 'تہجد',
    'prayer.sunrise': 'طلوع آفتاب',

    'home.greeting': 'السلام علیکم،',
    'home.tonightsJourney': 'آج رات کا سفر',
    'home.enterSilent': 'خاموش گھڑی میں داخل ہوں',
    'home.gateOpen': 'دروازہ کھلا ہے',
    'home.gateClosed': 'دروازہ بند ہے',
    'home.gateOpens': 'دروازہ {time} پر کھلتا ہے',
    'home.calculating': 'حساب کیا جا رہا ہے…',
    'home.lastThirdBegins': 'آخری تہائی شروع',

    'btn.cancel': 'منسوخ',
    'btn.save': 'محفوظ کریں',
    'btn.done': 'مکمل',
    'btn.continue': 'جاری رکھیں',
    'btn.skip': 'چھوڑیں',
    'btn.share': 'شیئر',
    'btn.delete': 'حذف کریں',
    'btn.confirm': 'تصدیق',
    'btn.close': 'بند کریں',
    'btn.ok': 'ٹھیک ہے',

    'settings.title': 'ترتیبات',
    'settings.prayerMethod': 'نماز کے اوقات کا طریقہ',
    'settings.reciter': 'قاری',
    'settings.sleepIntel': 'نیند کا انتظام',
    'settings.notifications': 'اطلاعات',
    'settings.appearance': 'ظاہری شکل',
    'settings.privacy': 'پرائیویسی',
    'settings.subscription': 'سبسکرپشن',
    'settings.about': 'تعارف',
    'settings.profile': 'پروفائل',
    'settings.homeScreen': 'ہوم اسکرین',

    'duaWall.title': 'دعا دیوار',
    'duaWall.quietTonight': 'آج رات خاموش · ذیل میں عمومی دعائیں',
    'duaWall.ameen': 'آمین',
    'duaWall.prayFor': 'دعا کریں',
    'duaWall.praying': 'دعا گو ہوں',
    'duaWall.share': 'اپنی دعا شیئر کریں',

    'error.generic': 'کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔',
    'error.network': 'انٹرنیٹ کنکشن نہیں ہے۔',
    'error.locationDenied': 'نماز کے اوقات کے لیے مقام کی اجازت درکار ہے۔',
};

// ── Turkish ────────────────────────────────────────────────────────────
const tr: Dict = {
    'tab.home': 'Ana Sayfa', 'tab.guide': 'Rehber', 'tab.duas': 'Dualar', 'tab.quran': 'Kur\'an', 'tab.prayers': 'Namazlar',
    'prayer.fajr': 'Fajr', 'prayer.dhuhr': 'Öğle', 'prayer.asr': 'İkindi', 'prayer.maghrib': 'Akşam', 'prayer.isha': 'Yatsı',
    'prayer.tahajjud': 'Teheccüd', 'prayer.sunrise': 'Güneş',
    'home.greeting': 'Esselamu Aleyküm,',
    'home.tonightsJourney': 'Bu Gecenin Yolculuğu',
    'home.enterSilent': 'Sessiz Saate Girin',
    'home.gateOpen': 'Kapı Açık',
    'home.gateClosed': 'Kapı Kapalı',
    'home.gateOpens': 'Kapı {time} açılır',
    'home.calculating': 'Hesaplanıyor…',
    'home.lastThirdBegins': 'SON ÜÇTE BİR BAŞLIYOR',
    'btn.cancel': 'İptal', 'btn.save': 'Kaydet', 'btn.done': 'Tamam', 'btn.continue': 'Devam',
    'btn.skip': 'Atla', 'btn.share': 'Paylaş', 'btn.delete': 'Sil', 'btn.confirm': 'Onayla',
    'btn.close': 'Kapat', 'btn.ok': 'Tamam',
    'settings.title': 'Ayarlar',
    'settings.prayerMethod': 'Namaz Vakti Hesaplama Yöntemi',
    'settings.reciter': 'Kur\'an Kârisi',
    'settings.sleepIntel': 'Uyku Zekâsı',
    'settings.notifications': 'Bildirimler',
    'settings.appearance': 'Görünüm',
    'settings.privacy': 'Gizlilik',
    'settings.subscription': 'Abonelik',
    'settings.about': 'Hakkında',
    'settings.profile': 'Profil',
    'settings.homeScreen': 'Ana Ekran',
    'duaWall.title': 'Dua Duvarı',
    'duaWall.quietTonight': 'Bu gece sessiz · evrensel dualar aşağıda',
    'duaWall.ameen': 'Âmin',
    'duaWall.prayFor': 'Onun için dua et',
    'duaWall.praying': 'Dua ediyorum',
    'duaWall.share': 'Duanı paylaş',
    'error.generic': 'Bir sorun oluştu. Lütfen tekrar deneyin.',
    'error.network': 'İnternet bağlantısı yok.',
    'error.locationDenied': 'Namaz vakitleri için konum erişimi gereklidir.',
};

// ── Indonesian ─────────────────────────────────────────────────────────
const id: Dict = {
    'tab.home': 'Beranda', 'tab.guide': 'Panduan', 'tab.duas': 'Doa', 'tab.quran': 'Al-Qur\'an', 'tab.prayers': 'Salat',
    'prayer.fajr': 'Subuh', 'prayer.dhuhr': 'Zuhur', 'prayer.asr': 'Asar', 'prayer.maghrib': 'Magrib', 'prayer.isha': 'Isya',
    'prayer.tahajjud': 'Tahajud', 'prayer.sunrise': 'Terbit',
    'home.greeting': 'Assalamualaikum,',
    'home.tonightsJourney': 'Perjalanan Malam Ini',
    'home.enterSilent': 'Masuk Waktu Hening',
    'home.gateOpen': 'Pintu Terbuka',
    'home.gateClosed': 'Pintu Tertutup',
    'home.gateOpens': 'Pintu terbuka pukul {time}',
    'home.calculating': 'Menghitung…',
    'home.lastThirdBegins': 'SEPERTIGA MALAM TERAKHIR DIMULAI',
    'btn.cancel': 'Batal', 'btn.save': 'Simpan', 'btn.done': 'Selesai', 'btn.continue': 'Lanjutkan',
    'btn.skip': 'Lewati', 'btn.share': 'Bagikan', 'btn.delete': 'Hapus', 'btn.confirm': 'Konfirmasi',
    'btn.close': 'Tutup', 'btn.ok': 'OK',
    'settings.title': 'Pengaturan',
    'settings.prayerMethod': 'Metode Perhitungan Waktu Salat',
    'settings.reciter': 'Qari',
    'settings.sleepIntel': 'Intelijen Tidur',
    'settings.notifications': 'Notifikasi',
    'settings.appearance': 'Tampilan',
    'settings.privacy': 'Privasi',
    'settings.subscription': 'Langganan',
    'settings.about': 'Tentang',
    'settings.profile': 'Profil',
    'settings.homeScreen': 'Layar Utama',
    'duaWall.title': 'Dinding Doa',
    'duaWall.quietTonight': 'Sepi malam ini · doa universal di bawah',
    'duaWall.ameen': 'Amin',
    'duaWall.prayFor': 'Doakan',
    'duaWall.praying': 'Sedang berdoa',
    'duaWall.share': 'Bagikan doamu',
    'error.generic': 'Terjadi kesalahan. Silakan coba lagi.',
    'error.network': 'Tidak ada koneksi internet.',
    'error.locationDenied': 'Akses lokasi diperlukan untuk waktu salat.',
};

// ── Malay ──────────────────────────────────────────────────────────────
const ms: Dict = {
    'tab.home': 'Utama', 'tab.guide': 'Panduan', 'tab.duas': 'Doa', 'tab.quran': 'Al-Quran', 'tab.prayers': 'Solat',
    'prayer.fajr': 'Subuh', 'prayer.dhuhr': 'Zohor', 'prayer.asr': 'Asar', 'prayer.maghrib': 'Maghrib', 'prayer.isha': 'Isyak',
    'prayer.tahajjud': 'Tahajud', 'prayer.sunrise': 'Syuruk',
    'home.greeting': 'Assalamualaikum,',
    'home.tonightsJourney': 'Perjalanan Malam Ini',
    'home.enterSilent': 'Masuk ke Saat Hening',
    'home.gateOpen': 'Pintu Terbuka',
    'home.gateClosed': 'Pintu Tertutup',
    'home.gateOpens': 'Pintu terbuka pada {time}',
    'home.calculating': 'Mengira…',
    'home.lastThirdBegins': 'SEPERTIGA MALAM TERAKHIR BERMULA',
    'btn.cancel': 'Batal', 'btn.save': 'Simpan', 'btn.done': 'Selesai', 'btn.continue': 'Teruskan',
    'btn.skip': 'Langkau', 'btn.share': 'Kongsi', 'btn.delete': 'Padam', 'btn.confirm': 'Sahkan',
    'btn.close': 'Tutup', 'btn.ok': 'OK',
    'settings.title': 'Tetapan',
    'settings.prayerMethod': 'Kaedah Pengiraan Waktu Solat',
    'settings.reciter': 'Qari',
    'settings.sleepIntel': 'Pintar Tidur',
    'settings.notifications': 'Pemberitahuan',
    'settings.appearance': 'Penampilan',
    'settings.privacy': 'Privasi',
    'settings.subscription': 'Langganan',
    'settings.about': 'Mengenai',
    'settings.profile': 'Profil',
    'settings.homeScreen': 'Skrin Utama',
    'duaWall.title': 'Dinding Doa',
    'duaWall.quietTonight': 'Sunyi malam ini · doa universal di bawah',
    'duaWall.ameen': 'Amin',
    'duaWall.prayFor': 'Doa untuknya',
    'duaWall.praying': 'Sedang berdoa',
    'duaWall.share': 'Kongsi doa anda',
    'error.generic': 'Sesuatu tidak kena. Sila cuba lagi.',
    'error.network': 'Tiada sambungan internet.',
    'error.locationDenied': 'Akses lokasi diperlukan untuk waktu solat.',
};

// ── Bengali ────────────────────────────────────────────────────────────
const bn: Dict = {
    'tab.home': 'হোম', 'tab.guide': 'গাইড', 'tab.duas': 'দোয়া', 'tab.quran': 'কুরআন', 'tab.prayers': 'নামাজ',
    'prayer.fajr': 'ফজর', 'prayer.dhuhr': 'যোহর', 'prayer.asr': 'আসর', 'prayer.maghrib': 'মাগরিব', 'prayer.isha': 'এশা',
    'prayer.tahajjud': 'তাহাজ্জুদ', 'prayer.sunrise': 'সূর্যোদয়',
    'home.greeting': 'আসসালামু আলাইকুম,',
    'home.tonightsJourney': 'আজ রাতের সফর',
    'home.enterSilent': 'নীরব মুহূর্তে প্রবেশ করুন',
    'home.gateOpen': 'দরজা খোলা',
    'home.gateClosed': 'দরজা বন্ধ',
    'home.gateOpens': 'দরজা খোলে {time} এ',
    'home.calculating': 'হিসাব করা হচ্ছে…',
    'home.lastThirdBegins': 'রাতের শেষ তৃতীয়াংশ শুরু',
    'btn.cancel': 'বাতিল', 'btn.save': 'সেভ', 'btn.done': 'সম্পন্ন', 'btn.continue': 'চালিয়ে যান',
    'btn.skip': 'বাদ দিন', 'btn.share': 'শেয়ার', 'btn.delete': 'মুছুন', 'btn.confirm': 'নিশ্চিত',
    'btn.close': 'বন্ধ', 'btn.ok': 'ঠিক আছে',
    'settings.title': 'সেটিংস',
    'settings.prayerMethod': 'নামাজের সময় গণনা পদ্ধতি',
    'settings.reciter': 'ক্বারী',
    'settings.sleepIntel': 'স্লিপ ইন্টেলিজেন্স',
    'settings.notifications': 'বিজ্ঞপ্তি',
    'settings.appearance': 'চেহারা',
    'settings.privacy': 'গোপনীয়তা',
    'settings.subscription': 'সাবস্ক্রিপশন',
    'settings.about': 'সম্পর্কে',
    'settings.profile': 'প্রোফাইল',
    'settings.homeScreen': 'হোম স্ক্রিন',
    'duaWall.title': 'দোয়া দেয়াল',
    'duaWall.quietTonight': 'আজ রাত নীরব · নিচে সর্বজনীন দোয়া',
    'duaWall.ameen': 'আমিন',
    'duaWall.prayFor': 'দোয়া করুন',
    'duaWall.praying': 'দোয়া করছি',
    'duaWall.share': 'আপনার দোয়া শেয়ার করুন',
    'error.generic': 'কিছু ভুল হয়েছে। আবার চেষ্টা করুন।',
    'error.network': 'ইন্টারনেট সংযোগ নেই।',
    'error.locationDenied': 'নামাজের সময়ের জন্য অবস্থানের অ্যাক্সেস প্রয়োজন।',
};

// ── French ─────────────────────────────────────────────────────────────
const fr: Dict = {
    'tab.home': 'Accueil', 'tab.guide': 'Guide', 'tab.duas': 'Invocations', 'tab.quran': 'Coran', 'tab.prayers': 'Prières',
    'prayer.fajr': 'Fajr', 'prayer.dhuhr': 'Dhouhr', 'prayer.asr': 'Asr', 'prayer.maghrib': 'Maghreb', 'prayer.isha': 'Icha',
    'prayer.tahajjud': 'Tahajjud', 'prayer.sunrise': 'Lever',
    'home.greeting': 'Assalamu Alaikum,',
    'home.tonightsJourney': 'Voyage de Cette Nuit',
    'home.enterSilent': 'Entrer dans l\'Heure du Silence',
    'home.gateOpen': 'Porte Ouverte',
    'home.gateClosed': 'Porte Fermée',
    'home.gateOpens': 'La porte s\'ouvre à {time}',
    'home.calculating': 'Calcul en cours…',
    'home.lastThirdBegins': 'DERNIER TIERS COMMENCE',
    'btn.cancel': 'Annuler', 'btn.save': 'Enregistrer', 'btn.done': 'Terminé', 'btn.continue': 'Continuer',
    'btn.skip': 'Passer', 'btn.share': 'Partager', 'btn.delete': 'Supprimer', 'btn.confirm': 'Confirmer',
    'btn.close': 'Fermer', 'btn.ok': 'OK',
    'settings.title': 'Paramètres',
    'settings.prayerMethod': 'Méthode de calcul des prières',
    'settings.reciter': 'Récitateur',
    'settings.sleepIntel': 'Intelligence du sommeil',
    'settings.notifications': 'Notifications',
    'settings.appearance': 'Apparence',
    'settings.privacy': 'Confidentialité',
    'settings.subscription': 'Abonnement',
    'settings.about': 'À propos',
    'settings.profile': 'Profil',
    'settings.homeScreen': 'Écran d\'accueil',
    'duaWall.title': 'Mur des Invocations',
    'duaWall.quietTonight': 'Calme cette nuit · invocations universelles ci-dessous',
    'duaWall.ameen': 'Amine',
    'duaWall.prayFor': 'Prier pour',
    'duaWall.praying': 'En prière',
    'duaWall.share': 'Partagez votre invocation',
    'error.generic': 'Une erreur est survenue. Réessayez.',
    'error.network': 'Pas de connexion Internet.',
    'error.locationDenied': 'L\'accès à la localisation est nécessaire pour les horaires de prière.',
};

// ── Persian / Farsi (RTL) ──────────────────────────────────────────────
const fa: Dict = {
    'tab.home': 'خانه', 'tab.guide': 'راهنما', 'tab.duas': 'دعاها', 'tab.quran': 'قرآن', 'tab.prayers': 'نمازها',
    'prayer.fajr': 'صبح', 'prayer.dhuhr': 'ظهر', 'prayer.asr': 'عصر', 'prayer.maghrib': 'مغرب', 'prayer.isha': 'عشاء',
    'prayer.tahajjud': 'تهجد', 'prayer.sunrise': 'طلوع آفتاب',
    'home.greeting': 'السلام علیکم،',
    'home.tonightsJourney': 'سفر امشب',
    'home.enterSilent': 'به ساعت سکوت وارد شوید',
    'home.gateOpen': 'دروازه باز است',
    'home.gateClosed': 'دروازه بسته است',
    'home.gateOpens': 'دروازه ساعت {time} باز می‌شود',
    'home.calculating': 'در حال محاسبه…',
    'home.lastThirdBegins': 'یک سوم پایانی شب آغاز می‌شود',
    'btn.cancel': 'لغو', 'btn.save': 'ذخیره', 'btn.done': 'انجام شد', 'btn.continue': 'ادامه',
    'btn.skip': 'رد کردن', 'btn.share': 'اشتراک', 'btn.delete': 'حذف', 'btn.confirm': 'تأیید',
    'btn.close': 'بستن', 'btn.ok': 'باشه',
    'settings.title': 'تنظیمات',
    'settings.prayerMethod': 'روش محاسبه اوقات نماز',
    'settings.reciter': 'قاری',
    'settings.sleepIntel': 'هوش خواب',
    'settings.notifications': 'اعلان‌ها',
    'settings.appearance': 'ظاهر',
    'settings.privacy': 'حریم خصوصی',
    'settings.subscription': 'اشتراک',
    'settings.about': 'درباره',
    'settings.profile': 'پروفایل',
    'settings.homeScreen': 'صفحه اصلی',
    'duaWall.title': 'دیوار دعا',
    'duaWall.quietTonight': 'امشب آرام است · دعاهای جهانی در پایین',
    'duaWall.ameen': 'آمین',
    'duaWall.prayFor': 'برایش دعا کن',
    'duaWall.praying': 'در حال دعا',
    'duaWall.share': 'دعای خود را به اشتراک بگذارید',
    'error.generic': 'مشکلی پیش آمد. دوباره تلاش کنید.',
    'error.network': 'اتصال اینترنت برقرار نیست.',
    'error.locationDenied': 'برای اوقات نماز دسترسی به موقعیت لازم است.',
};

// ── Hindi ──────────────────────────────────────────────────────────────
const hi: Dict = {
    'tab.home': 'होम', 'tab.guide': 'गाइड', 'tab.duas': 'दुआएँ', 'tab.quran': 'क़ुरआन', 'tab.prayers': 'नमाज़ें',
    'prayer.fajr': 'फ़ज्र', 'prayer.dhuhr': 'ज़ुहर', 'prayer.asr': 'अस्र', 'prayer.maghrib': 'मग़रिब', 'prayer.isha': 'इशा',
    'prayer.tahajjud': 'तहज्जुद', 'prayer.sunrise': 'सूर्योदय',
    'home.greeting': 'अस्सलामु अलैकुम,',
    'home.tonightsJourney': 'आज रात का सफ़र',
    'home.enterSilent': 'शांत घड़ी में प्रवेश करें',
    'home.gateOpen': 'द्वार खुला है',
    'home.gateClosed': 'द्वार बंद है',
    'home.gateOpens': 'द्वार {time} पर खुलता है',
    'home.calculating': 'गणना हो रही है…',
    'home.lastThirdBegins': 'रात का अंतिम तिहाई शुरू',
    'btn.cancel': 'रद्द करें', 'btn.save': 'सहेजें', 'btn.done': 'हो गया', 'btn.continue': 'जारी रखें',
    'btn.skip': 'छोड़ें', 'btn.share': 'साझा करें', 'btn.delete': 'हटाएँ', 'btn.confirm': 'पुष्टि करें',
    'btn.close': 'बंद करें', 'btn.ok': 'ठीक है',
    'settings.title': 'सेटिंग्स',
    'settings.prayerMethod': 'नमाज़ समय गणना विधि',
    'settings.reciter': 'क़ारी',
    'settings.sleepIntel': 'नींद की समझ',
    'settings.notifications': 'सूचनाएँ',
    'settings.appearance': 'दिखावट',
    'settings.privacy': 'गोपनीयता',
    'settings.subscription': 'सब्सक्रिप्शन',
    'settings.about': 'के बारे में',
    'settings.profile': 'प्रोफ़ाइल',
    'settings.homeScreen': 'होम स्क्रीन',
    'duaWall.title': 'दुआ की दीवार',
    'duaWall.quietTonight': 'आज रात शांत · नीचे सार्वभौमिक दुआएँ',
    'duaWall.ameen': 'आमीन',
    'duaWall.prayFor': 'दुआ करें',
    'duaWall.praying': 'दुआ कर रहा हूँ',
    'duaWall.share': 'अपनी दुआ साझा करें',
    'error.generic': 'कुछ गड़बड़ हुई। फिर कोशिश करें।',
    'error.network': 'इंटरनेट कनेक्शन नहीं है।',
    'error.locationDenied': 'नमाज़ के समय के लिए स्थान की अनुमति आवश्यक है।',
};

// ── Russian ────────────────────────────────────────────────────────────
const ru: Dict = {
    'tab.home': 'Главная', 'tab.guide': 'Гид', 'tab.duas': 'Дуа', 'tab.quran': 'Коран', 'tab.prayers': 'Намазы',
    'prayer.fajr': 'Фаджр', 'prayer.dhuhr': 'Зухр', 'prayer.asr': 'Аср', 'prayer.maghrib': 'Магриб', 'prayer.isha': 'Иша',
    'prayer.tahajjud': 'Тахаджуд', 'prayer.sunrise': 'Восход',
    'home.greeting': 'Ассаламу алейкум,',
    'home.tonightsJourney': 'Путешествие этой ночи',
    'home.enterSilent': 'Войдите в тихий час',
    'home.gateOpen': 'Врата открыты',
    'home.gateClosed': 'Врата закрыты',
    'home.gateOpens': 'Врата откроются в {time}',
    'home.calculating': 'Расчёт…',
    'home.lastThirdBegins': 'НАЧИНАЕТСЯ ПОСЛЕДНЯЯ ТРЕТЬ',
    'btn.cancel': 'Отмена', 'btn.save': 'Сохранить', 'btn.done': 'Готово', 'btn.continue': 'Продолжить',
    'btn.skip': 'Пропустить', 'btn.share': 'Поделиться', 'btn.delete': 'Удалить', 'btn.confirm': 'Подтвердить',
    'btn.close': 'Закрыть', 'btn.ok': 'OK',
    'settings.title': 'Настройки',
    'settings.prayerMethod': 'Метод расчёта времени намаза',
    'settings.reciter': 'Чтец',
    'settings.sleepIntel': 'Анализ сна',
    'settings.notifications': 'Уведомления',
    'settings.appearance': 'Внешний вид',
    'settings.privacy': 'Конфиденциальность',
    'settings.subscription': 'Подписка',
    'settings.about': 'О приложении',
    'settings.profile': 'Профиль',
    'settings.homeScreen': 'Главный экран',
    'duaWall.title': 'Стена дуа',
    'duaWall.quietTonight': 'Тихо этой ночью · универсальные дуа ниже',
    'duaWall.ameen': 'Амин',
    'duaWall.prayFor': 'Помолиться',
    'duaWall.praying': 'Молюсь',
    'duaWall.share': 'Поделиться своей дуа',
    'error.generic': 'Что-то пошло не так. Попробуйте снова.',
    'error.network': 'Нет подключения к Интернету.',
    'error.locationDenied': 'Для времени намаза нужен доступ к геолокации.',
};

// ── Bosnian ────────────────────────────────────────────────────────────
const bs: Dict = {
    'tab.home': 'Početna', 'tab.guide': 'Vodič', 'tab.duas': 'Dove', 'tab.quran': 'Kur\'an', 'tab.prayers': 'Namazi',
    'prayer.fajr': 'Sabah', 'prayer.dhuhr': 'Podne', 'prayer.asr': 'Ikindija', 'prayer.maghrib': 'Akšam', 'prayer.isha': 'Jacija',
    'prayer.tahajjud': 'Tehedžud', 'prayer.sunrise': 'Izlazak',
    'home.greeting': 'Es-selamu alejkum,',
    'home.tonightsJourney': 'Putovanje Večeras',
    'home.enterSilent': 'Uđi u Tihi Sat',
    'home.gateOpen': 'Vrata su Otvorena',
    'home.gateClosed': 'Vrata su Zatvorena',
    'home.gateOpens': 'Vrata se otvaraju u {time}',
    'home.calculating': 'Računam…',
    'home.lastThirdBegins': 'POČINJE POSLJEDNJA TREĆINA',
    'btn.cancel': 'Otkaži', 'btn.save': 'Sačuvaj', 'btn.done': 'Gotovo', 'btn.continue': 'Nastavi',
    'btn.skip': 'Preskoči', 'btn.share': 'Podijeli', 'btn.delete': 'Obriši', 'btn.confirm': 'Potvrdi',
    'btn.close': 'Zatvori', 'btn.ok': 'OK',
    'settings.title': 'Postavke',
    'settings.prayerMethod': 'Metoda izračuna vremena namaza',
    'settings.reciter': 'Učač',
    'settings.sleepIntel': 'Pametan san',
    'settings.notifications': 'Obavještenja',
    'settings.appearance': 'Izgled',
    'settings.privacy': 'Privatnost',
    'settings.subscription': 'Pretplata',
    'settings.about': 'O aplikaciji',
    'settings.profile': 'Profil',
    'settings.homeScreen': 'Početni ekran',
    'duaWall.title': 'Zid dova',
    'duaWall.quietTonight': 'Tiho večeras · univerzalne dove dolje',
    'duaWall.ameen': 'Amin',
    'duaWall.prayFor': 'Moli za',
    'duaWall.praying': 'Molim',
    'duaWall.share': 'Podijeli svoju dovu',
    'error.generic': 'Nešto je pošlo po zlu. Pokušajte ponovo.',
    'error.network': 'Nema internet konekcije.',
    'error.locationDenied': 'Za vremena namaza potreban je pristup lokaciji.',
};

// ── Spanish ────────────────────────────────────────────────────────────
const es: Dict = {
    'tab.home': 'Inicio', 'tab.guide': 'Guía', 'tab.duas': 'Súplicas', 'tab.quran': 'Corán', 'tab.prayers': 'Oraciones',
    'prayer.fajr': 'Fayr', 'prayer.dhuhr': 'Dhuhr', 'prayer.asr': 'Asr', 'prayer.maghrib': 'Magrib', 'prayer.isha': 'Isha',
    'prayer.tahajjud': 'Tahayyud', 'prayer.sunrise': 'Amanecer',
    'home.greeting': 'Assalamu Alaikum,',
    'home.tonightsJourney': 'Viaje de Esta Noche',
    'home.enterSilent': 'Entra en la Hora del Silencio',
    'home.gateOpen': 'La Puerta está Abierta',
    'home.gateClosed': 'La Puerta está Cerrada',
    'home.gateOpens': 'La puerta abre a las {time}',
    'home.calculating': 'Calculando…',
    'home.lastThirdBegins': 'EMPIEZA EL ÚLTIMO TERCIO',
    'btn.cancel': 'Cancelar', 'btn.save': 'Guardar', 'btn.done': 'Listo', 'btn.continue': 'Continuar',
    'btn.skip': 'Saltar', 'btn.share': 'Compartir', 'btn.delete': 'Eliminar', 'btn.confirm': 'Confirmar',
    'btn.close': 'Cerrar', 'btn.ok': 'OK',
    'settings.title': 'Ajustes',
    'settings.prayerMethod': 'Método de cálculo del rezo',
    'settings.reciter': 'Recitador',
    'settings.sleepIntel': 'Inteligencia del Sueño',
    'settings.notifications': 'Notificaciones',
    'settings.appearance': 'Apariencia',
    'settings.privacy': 'Privacidad',
    'settings.subscription': 'Suscripción',
    'settings.about': 'Acerca de',
    'settings.profile': 'Perfil',
    'settings.homeScreen': 'Pantalla de inicio',
    'duaWall.title': 'Muro de Súplicas',
    'duaWall.quietTonight': 'Silencio esta noche · súplicas universales abajo',
    'duaWall.ameen': 'Amín',
    'duaWall.prayFor': 'Reza por',
    'duaWall.praying': 'Rezando',
    'duaWall.share': 'Comparte tu súplica',
    'error.generic': 'Algo salió mal. Inténtalo de nuevo.',
    'error.network': 'Sin conexión a Internet.',
    'error.locationDenied': 'Se necesita el acceso a la ubicación para los horarios de oración.',
};

// ── German ─────────────────────────────────────────────────────────────
const de: Dict = {
    'tab.home': 'Start', 'tab.guide': 'Leitfaden', 'tab.duas': 'Bittgebete', 'tab.quran': 'Koran', 'tab.prayers': 'Gebete',
    'prayer.fajr': 'Fadschr', 'prayer.dhuhr': 'Dhuhr', 'prayer.asr': 'Asr', 'prayer.maghrib': 'Maghrib', 'prayer.isha': 'Ischa',
    'prayer.tahajjud': 'Tahajjud', 'prayer.sunrise': 'Sonnenaufgang',
    'home.greeting': 'Assalamu Alaikum,',
    'home.tonightsJourney': 'Reise dieser Nacht',
    'home.enterSilent': 'Betritt die stille Stunde',
    'home.gateOpen': 'Das Tor ist offen',
    'home.gateClosed': 'Das Tor ist geschlossen',
    'home.gateOpens': 'Tor öffnet um {time}',
    'home.calculating': 'Berechnung…',
    'home.lastThirdBegins': 'LETZTES DRITTEL BEGINNT',
    'btn.cancel': 'Abbrechen', 'btn.save': 'Speichern', 'btn.done': 'Fertig', 'btn.continue': 'Weiter',
    'btn.skip': 'Überspringen', 'btn.share': 'Teilen', 'btn.delete': 'Löschen', 'btn.confirm': 'Bestätigen',
    'btn.close': 'Schließen', 'btn.ok': 'OK',
    'settings.title': 'Einstellungen',
    'settings.prayerMethod': 'Berechnungsmethode der Gebetszeiten',
    'settings.reciter': 'Rezitator',
    'settings.sleepIntel': 'Schlafintelligenz',
    'settings.notifications': 'Benachrichtigungen',
    'settings.appearance': 'Erscheinungsbild',
    'settings.privacy': 'Datenschutz',
    'settings.subscription': 'Abonnement',
    'settings.about': 'Über',
    'settings.profile': 'Profil',
    'settings.homeScreen': 'Startbildschirm',
    'duaWall.title': 'Bittgebets-Wand',
    'duaWall.quietTonight': 'Heute Nacht still · universelle Bittgebete unten',
    'duaWall.ameen': 'Amin',
    'duaWall.prayFor': 'Bete für',
    'duaWall.praying': 'Bete',
    'duaWall.share': 'Teile dein Bittgebet',
    'error.generic': 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
    'error.network': 'Keine Internetverbindung.',
    'error.locationDenied': 'Standortzugriff ist für die Gebetszeiten erforderlich.',
};

// ── Albanian ───────────────────────────────────────────────────────────
const sq: Dict = {
    'tab.home': 'Ballina', 'tab.guide': 'Udhëzues', 'tab.duas': 'Lutjet', 'tab.quran': 'Kur\'an', 'tab.prayers': 'Namazet',
    'prayer.fajr': 'Sabahu', 'prayer.dhuhr': 'Drekë', 'prayer.asr': 'Ikindi', 'prayer.maghrib': 'Akshami', 'prayer.isha': 'Jacia',
    'prayer.tahajjud': 'Tehexhud', 'prayer.sunrise': 'Lindja e diellit',
    'home.greeting': 'Es-selamu alejkum,',
    'home.tonightsJourney': 'Udhëtimi i Sonte',
    'home.enterSilent': 'Hyr në Orën e Heshtjes',
    'home.gateOpen': 'Porta është Hapur',
    'home.gateClosed': 'Porta është Mbyllur',
    'home.gateOpens': 'Porta hapet në {time}',
    'home.calculating': 'Duke llogaritur…',
    'home.lastThirdBegins': 'FILLON E TRETA E FUNDIT',
    'btn.cancel': 'Anulo', 'btn.save': 'Ruaj', 'btn.done': 'U krye', 'btn.continue': 'Vazhdo',
    'btn.skip': 'Anashkalo', 'btn.share': 'Shpërnda', 'btn.delete': 'Fshi', 'btn.confirm': 'Konfirmo',
    'btn.close': 'Mbyll', 'btn.ok': 'OK',
    'settings.title': 'Cilësimet',
    'settings.prayerMethod': 'Metoda e llogaritjes së namazit',
    'settings.reciter': 'Lexuesi',
    'settings.sleepIntel': 'Inteligjenca e gjumit',
    'settings.notifications': 'Njoftime',
    'settings.appearance': 'Pamja',
    'settings.privacy': 'Privatësia',
    'settings.subscription': 'Abonimi',
    'settings.about': 'Rreth',
    'settings.profile': 'Profili',
    'settings.homeScreen': 'Ekrani fillestar',
    'duaWall.title': 'Muri i Lutjeve',
    'duaWall.quietTonight': 'Heshtje sonte · lutje universale më poshtë',
    'duaWall.ameen': 'Amin',
    'duaWall.prayFor': 'Lutu për',
    'duaWall.praying': 'Po lutem',
    'duaWall.share': 'Ndaj lutjen tënde',
    'error.generic': 'Diçka shkoi keq. Provo përsëri.',
    'error.network': 'Nuk ka lidhje interneti.',
    'error.locationDenied': 'Qasja në vendndodhje është e nevojshme për kohët e namazit.',
};

const DICTS: Record<Locale, Dict> = {
    en, ar, ur, tr, id, ms, bn, fr, fa, hi, ru, bs, es, de, sq,
};

export const LOCALES: { code: Locale; label: string; native: string; rtl: boolean }[] = [
    { code: 'en', label: 'English',    native: 'English',     rtl: false },
    { code: 'ar', label: 'Arabic',     native: 'العربية',     rtl: true  },
    { code: 'ur', label: 'Urdu',       native: 'اردو',        rtl: true  },
    { code: 'tr', label: 'Turkish',    native: 'Türkçe',      rtl: false },
    { code: 'id', label: 'Indonesian', native: 'Bahasa Indonesia', rtl: false },
    { code: 'ms', label: 'Malay',      native: 'Bahasa Melayu', rtl: false },
    { code: 'bn', label: 'Bengali',    native: 'বাংলা',        rtl: false },
    { code: 'fr', label: 'French',     native: 'Français',    rtl: false },
    { code: 'fa', label: 'Persian',    native: 'فارسی',       rtl: true  },
    { code: 'hi', label: 'Hindi',      native: 'हिन्दी',       rtl: false },
    { code: 'ru', label: 'Russian',    native: 'Русский',     rtl: false },
    { code: 'bs', label: 'Bosnian',    native: 'Bosanski',    rtl: false },
    { code: 'es', label: 'Spanish',    native: 'Español',     rtl: false },
    { code: 'de', label: 'German',     native: 'Deutsch',     rtl: false },
    { code: 'sq', label: 'Albanian',   native: 'Shqip',       rtl: false },
];

let currentLocale: Locale = 'en';

function detectFromDevice(): Locale {
    try {
        const code = (Localization.getLocales()[0]?.languageCode ?? 'en').toLowerCase();
        // Map the device's primary language code to one we support.
        const supported: Locale[] = ['en', 'ar', 'ur', 'tr', 'id', 'ms', 'bn', 'fr', 'fa', 'hi', 'ru', 'bs', 'es', 'de', 'sq'];
        if ((supported as string[]).includes(code)) return code as Locale;
    } catch { /* ignore */ }
    return 'en';
}

// Bootstrap at module load
(async () => {
    try {
        const saved = await AsyncStorage.getItem(LOCALE_KEY);
        if (saved && saved in DICTS) {
            currentLocale = saved as Locale;
        } else {
            currentLocale = detectFromDevice();
        }
    } catch {
        currentLocale = detectFromDevice();
    }
})();

/** Returns the translated string for the current locale, falling back to English. */
export function t(key: string, vars?: Record<string, string | number>): string {
    let str = DICTS[currentLocale]?.[key] ?? DICTS.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            str = str.replace(`{${k}}`, String(v));
        }
    }
    return str;
}

/** Current active locale code. */
export function getLocale(): Locale {
    return currentLocale;
}

/** Manually set the locale (e.g. from Settings) and broadcast a change event. */
export async function setLocale(locale: Locale): Promise<void> {
    currentLocale = locale;
    try { await AsyncStorage.setItem(LOCALE_KEY, locale); } catch { /* ignore */ }
    DeviceEventEmitter.emit('localeChanged', locale);
}

/** True if the current locale is RTL — pair with `I18nManager.forceRTL` for full mirror. */
export function isRTL(): boolean {
    return LOCALES.find(l => l.code === currentLocale)?.rtl ?? false;
}
