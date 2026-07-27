// ── PraxiOS: Geteilte Typen für den Fragebogen-Creator ─────────────────────
// Kopfbogen (Pflicht-Stammdaten, bei jedem Bogen identisch) + Blocksystem
// aus fünf Blocktypen. Wird vom Bogen-Editor, der Ausfüll-Seite und dem
// PDF-Renderer gemeinsam genutzt.

export const BLOCK_TYPEN = [
  "checkboxen",
  "textfeld",
  "textfeld_schreibfeld",
  "skala_1_10",
  "haeufigkeit",
] as const;
export type BlockTyp = (typeof BLOCK_TYPEN)[number];

export const BLOCK_TYP_LABEL: Record<BlockTyp, string> = {
  checkboxen: "Ankreuz-Fragen",
  textfeld: "Textfeld",
  textfeld_schreibfeld: "Textfeld mit Schreibfeld",
  skala_1_10: "Skala 1–10",
  haeufigkeit: "Häufigkeitsskala",
};

export const HAEUFIGKEIT_STUFEN = [
  "gar nicht",
  "wenig",
  "normal",
  "häufig",
  "sehr häufig",
] as const;

/** Konfiguration je Blocktyp (als JSON in anamnesis_blocks.config). */
export interface BlockConfig {
  /** checkboxen: Fragen + Spaltenzahl (1|2). */
  fragen?: string[];
  spalten?: 1 | 2;
  /** textfeld / textfeld_schreibfeld / skala_1_10: die eine Frage. */
  frage?: string;
  /** textfeld_schreibfeld: Anzahl Schreibzeilen (default 4). */
  zeilen?: number;
  /** skala_1_10: Endpunkt-Beschriftungen. */
  vonLabel?: string;
  bisLabel?: string;
}

/** Ein Block im Bogen (Referenz zum Katalog ODER Inline-Definition). */
export interface FormBlock {
  blockId?: number; // Referenz zum Block-Katalog
  typ: BlockTyp; // gespiegelt (robust gegen Katalog-Umbenennungen)
  titel: string;
  config: BlockConfig;
}

/** Kopfbogen: Pflicht-Stammdaten (Schlüssel -> Label, Pflicht-Flag). */
export type KopfbogenKey =
  | "nachname"
  | "vorname"
  | "geburtsdatum"
  | "strasse"
  | "plz"
  | "ort"
  | "telefon"
  | "email"
  | "krankenkasse";

export const KOPFBOGEN_FELDER: readonly {
  key: KopfbogenKey;
  label: string;
  pflicht: boolean;
  typ?: "datum" | "email";
}[] = [
  { key: "nachname", label: "Nachname", pflicht: true },
  { key: "vorname", label: "Vorname", pflicht: true },
  { key: "geburtsdatum", label: "Geburtsdatum", pflicht: true, typ: "datum" },
  { key: "strasse", label: "Straße", pflicht: true },
  { key: "plz", label: "PLZ", pflicht: true },
  { key: "ort", label: "Ort", pflicht: true },
  { key: "telefon", label: "Telefon", pflicht: false },
  { key: "email", label: "E-Mail", pflicht: false, typ: "email" },
  { key: "krankenkasse", label: "Krankenkasse", pflicht: false },
];

/** Antworten einer Einreichung (JSON in anamnesis_submissions.daten). */
export interface SubmissionDaten {
  kopfbogen: Partial<Record<KopfbogenKey, string>>;
  antworten: {
    titel: string;
    typ: BlockTyp;
    // checkboxen: gewählte Fragen; textfeld/schreibfeld: Text; skala: 1-10; haeufigkeit: je Frage Stufe
    wert: string[] | string | number | Record<string, string>;
  }[];
}

/** Öffentliche (loginfreie) Sicht auf einen Link + Bogen. */
export interface OeffentlicherBogen {
  formTitel: string;
  formBeschreibung: string | null;
  bloecke: FormBlock[];
  praxisName: string | null;
  vorbefuellung: Partial<Record<KopfbogenKey, string>> | null;
  linkStatus: "offen" | "eingereicht" | "abgelaufen";
  eingereichtAm: string | null;
  /** Sprache der Darstellung (ISO-Code, „de" = unübersetzt). */
  sprache: string;
  /** Übersetzte Kopfbogen-Labels je Feld (bei sprache != de). */
  kopfbogenLabels?: Partial<Record<KopfbogenKey, string>>;
  /** Übersetzte Häufigkeits-Stufen (bei sprache != de). */
  haeufigkeitStufen?: string[];
  /** Rückwärts-Map übersetzt → deutsch (kategoriale Texte, für datenDe). */
  rueckMap?: Record<string, string>;
}

// ── Mehrsprachigkeit (1.1.0) ────────────────────────────────────────────────
export const SPRACHEN: { code: string; flagge: string; name: string }[] = [
  { code: "de", flagge: "🇩🇪", name: "Deutsch" },
  { code: "en", flagge: "🇬🇧", name: "English" },
  { code: "tr", flagge: "🇹🇷", name: "Türkçe" },
  { code: "ar", flagge: "🇸🇦", name: "العربية" },
  { code: "ru", flagge: "🇷🇺", name: "Русский" },
  { code: "uk", flagge: "🇺🇦", name: "Українська" },
  { code: "sk", flagge: "🇸🇰", name: "Slovenčina" },
];

/** UI-Chrom-Texte handgepflegt (rechtssicher); Inhalte laufen über die MT. */
export type UiKey =
  | "waehleSprache"
  | "weiter"
  | "kopfbogenTitel"
  | "absenden"
  | "wirdGesendet"
  | "datenschutz"
  | "unterschrift"
  | "namePlatzhalter"
  | "danke"
  | "dankeText"
  | "fehlerDatenschutz"
  | "fehlerUnterschrift"
  | "bereitsEingereicht"
  | "abgelaufen"
  | "abgelaufenText";

export const UI_STRINGS: Record<string, Record<UiKey, string>> = {
  de: {
    waehleSprache: "Bitte wählen Sie Ihre Sprache",
    weiter: "Weiter",
    kopfbogenTitel: "Persönliche Daten",
    absenden: "Bogen einreichen",
    wirdGesendet: "Wird gesendet …",
    datenschutz:
      "Ich stimme zu, dass meine Angaben zur Behandlung und Abrechnung in der Patientenakte der Praxis gespeichert werden (DSGVO).",
    unterschrift: "Unterschrift (Name in Klartext)",
    namePlatzhalter: "Vorname Nachname",
    danke: "Vielen Dank!",
    dankeText: "Ihre Angaben wurden übermittelt und in Ihrer Patientenakte hinterlegt.",
    fehlerDatenschutz: "Bitte bestätigen Sie die Datenschutzerklärung.",
    fehlerUnterschrift: "Bitte bestätigen Sie mit Ihrem Namen (Unterschrift).",
    bereitsEingereicht: "Dieser Bogen wurde bereits eingereicht.",
    abgelaufen: "Dieser Link ist abgelaufen.",
    abgelaufenText: "Bitte wenden Sie sich für einen neuen Link an die Praxis.",
  },
  en: {
    waehleSprache: "Please choose your language",
    weiter: "Continue",
    kopfbogenTitel: "Personal details",
    absenden: "Submit form",
    wirdGesendet: "Sending …",
    datenschutz:
      "I agree that my details may be stored in the practice's patient record for treatment and billing purposes (GDPR).",
    unterschrift: "Signature (full name)",
    namePlatzhalter: "First name Last name",
    danke: "Thank you!",
    dankeText: "Your details have been submitted and added to your patient record.",
    fehlerDatenschutz: "Please confirm the privacy policy.",
    fehlerUnterschrift: "Please confirm with your name (signature).",
    bereitsEingereicht: "This form has already been submitted.",
    abgelaufen: "This link has expired.",
    abgelaufenText: "Please contact the practice for a new link.",
  },
  tr: {
    waehleSprache: "Lütfen dilinizi seçin",
    weiter: "Devam et",
    kopfbogenTitel: "Kişisel bilgiler",
    absenden: "Formu gönder",
    wirdGesendet: "Gönderiliyor …",
    datenschutz:
      "Bilgilerimin tedavi ve faturalandırma amacıyla muayenehanenin hasta kayıtlarına kaydedilmesini kabul ediyorum (KVKK/GDPR).",
    unterschrift: "İmza (ad ve soyad)",
    namePlatzhalter: "Ad Soyad",
    danke: "Teşekkürler!",
    dankeText: "Bilgileriniz iletildi ve hasta dosyanıza eklendi.",
    fehlerDatenschutz: "Lütfen gizlilik politikasını onaylayın.",
    fehlerUnterschrift: "Lütfen adınızla (imza) onaylayın.",
    bereitsEingereicht: "Bu form zaten gönderildi.",
    abgelaufen: "Bu bağlantının süresi doldu.",
    abgelaufenText: "Yeni bir bağlantı için lütfen muayenehane ile iletişime geçin.",
  },
  ar: {
    waehleSprache: "يرجى اختيار لغتك",
    weiter: "متابعة",
    kopfbogenTitel: "البيانات الشخصية",
    absenden: "إرسال النموذج",
    wirdGesendet: "جارٍ الإرسال …",
    datenschutz:
      "أوافق على حفظ بياناتي في ملف المريض لدى العيادة لأغراض العلاج والفوترة (GDPR).",
    unterschrift: "التوقيع (الاسم الكامل)",
    namePlatzhalter: "الاسم الأول اسم العائلة",
    danke: "شكرًا لك!",
    dankeText: "تم إرسال بياناتك وإضافتها إلى ملف المريض الخاص بك.",
    fehlerDatenschutz: "يرجى تأكيد سياسة الخصوصية.",
    fehlerUnterschrift: "يرجى التأكيد باسمك (التوقيع).",
    bereitsEingereicht: "تم إرسال هذا النموذج مسبقًا.",
    abgelaufen: "انتهت صلاحية هذا الرابط.",
    abgelaufenText: "يرجى التواصل مع العيادة للحصول على رابط جديد.",
  },
  ru: {
    waehleSprache: "Пожалуйста, выберите язык",
    weiter: "Далее",
    kopfbogenTitel: "Личные данные",
    absenden: "Отправить форму",
    wirdGesendet: "Отправка …",
    datenschutz:
      "Я соглашаюсь на сохранение моих данных в карте пациента клиники для целей лечения и выставления счетов (GDPR).",
    unterschrift: "Подпись (полное имя)",
    namePlatzhalter: "Имя Фамилия",
    danke: "Спасибо!",
    dankeText: "Ваши данные отправлены и добавлены в вашу карту пациента.",
    fehlerDatenschutz: "Пожалуйста, подтвердите политику конфиденциальности.",
    fehlerUnterschrift: "Пожалуйста, подтвердите своим именем (подпись).",
    bereitsEingereicht: "Эта форма уже была отправлена.",
    abgelaufen: "Срок действия этой ссылки истек.",
    abgelaufenText: "Пожалуйста, обратитесь в клинику за новой ссылкой.",
  },
  uk: {
    waehleSprache: "Будь ласка, оберіть мову",
    weiter: "Далі",
    kopfbogenTitel: "Особисті дані",
    absenden: "Надіслати форму",
    wirdGesendet: "Надсилання …",
    datenschutz:
      "Я погоджуюся на зберігання моїх даних у карті пацієнта клініки з метою лікування та виставлення рахунків (GDPR).",
    unterschrift: "Підпис (повне ім'я)",
    namePlatzhalter: "Ім'я Прізвище",
    danke: "Дякую!",
    dankeText: "Ваші дані надіслано та додано до вашої карти пацієнта.",
    fehlerDatenschutz: "Будь ласка, підтвердіть політику конфіденційності.",
    fehlerUnterschrift: "Будь ласка, підтвердіть своїм ім'ям (підпис).",
    bereitsEingereicht: "Цю форму вже було надіслано.",
    abgelaufen: "Термін дії цього посилання минув.",
    abgelaufenText: "Будь ласка, зверніться до клініки за новим посиланням.",
  },
  sk: {
    waehleSprache: "Vyberte si prosím svoj jazyk",
    weiter: "Pokračovať",
    kopfbogenTitel: "Osobné údaje",
    absenden: "Odoslať formulár",
    wirdGesendet: "Odosiela sa …",
    datenschutz:
      "Súhlasím s uložením mojich údajov do karty pacienta ambulancie na účely liečby a fakturácie (GDPR).",
    unterschrift: "Podpis (celé meno)",
    namePlatzhalter: "Meno Priezvisko",
    danke: "Ďakujem!",
    dankeText: "Vaše údaje boli odoslané a pridané do vašej karty pacienta.",
    fehlerDatenschutz: "Prosím potvrďte zásady ochrany údajov.",
    fehlerUnterschrift: "Prosím potvrďte svojím menom (podpis).",
    bereitsEingereicht: "Tento formulár už bol odoslaný.",
    abgelaufen: "Platnosť tohto odkazu vypršala.",
    abgelaufenText: "Pre nový odkaz sa prosím obráťte na ambulanciu.",
  },
};
