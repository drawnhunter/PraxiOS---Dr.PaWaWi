/**
 * Dr.-X-Anamnesebogen — Muster, 1:1 aus dem echten Praxis-Bogen digitalisiert
 * (inkl. DSGVO-Einwilligungserklärung und IMTZ-Schweigepflichtsentbindung).
 * Dient als Startpunkt für die eigene Praxis (Muster importieren → anpassen).
 */
export const DRX_BOGEN = {
  titel: "Anamnesebogen (Dr. X)",
  beschreibung:
    "Allgemeiner Anamnesebogen inkl. DSGVO-Einwilligung und IMTZ-Datenweitergabe — digitalisiert aus dem Praxis-Original.",
  bloecke: [
    {
      typ: "infotext",
      titel: "Willkommen",
      config: {
        text: "Bevor wir mit Ihnen die Möglichkeiten einer Therapie besprechen, bitten wir Sie, die folgenden Fragen sorgfältig und so detailliert wie möglich zu beantworten. Dies hilft uns, Ihre gesundheitliche Situation bestmöglich zu verstehen, eventuellen Risiken vorzubeugen und eine zielgerichtete Therapie zu planen. Selbstverständlich unterliegen alle Ihre Angaben der ärztlichen Schweigepflicht.",
        checkboxLabel: "",
        pflicht: false,
      },
    },
    // A. Persönliche Daten → fester Kopfbogen im System (nicht als Block nötig)
    {
      typ: "textfeld_schreibfeld",
      titel: "Hauptbeschwerden & Ziele",
      config: { frage: "Was sind Ihre aktuellen Hauptbeschwerden?", pflicht: true },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Hauptbeschwerden & Ziele",
      config: { frage: "Seit wann bestehen diese Beschwerden in etwa?", pflicht: false },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Hauptbeschwerden & Ziele",
      config: { frage: "Was verbessert Ihre Symptome?", pflicht: false },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Hauptbeschwerden & Ziele",
      config: { frage: "Was verschlechtert Ihre Symptome?", pflicht: false },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Hauptbeschwerden & Ziele",
      config: { frage: "Welche Diagnosen wurden bisher gestellt?", pflicht: false },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Hauptbeschwerden & Ziele",
      config: { frage: "Was ist Ihr persönliches Hauptziel für diese Therapie?", pflicht: false },
    },
    {
      typ: "jaNein",
      titel: "Medizinische Vorgeschichte & Vorerkrankungen",
      config: {
        fragen: [
          "Herz- und Kreislauf (z. B. Bluthochdruck)",
          "Lungen / Atemwege",
          "Nieren / Harnorgane",
          "Magen-Darm-Trakt",
          "Gefäße (Thrombosen, Embolien)",
          "Wirbelsäule (z. B. Bandscheibenvorfall)",
          "Neurologisch (z. B. Schlaganfall, Epilepsie)",
          "Stoffwechsel / Schilddrüse (z. B. Diabetes)",
          "Chronische Entzündungen / Autoimmun",
          "Krebserkrankungen (aktuell oder früher)",
        ],
        notizFrage: "Wenn ja, welche / seit wann?",
        pflicht: false,
      },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Medizinische Vorgeschichte & Vorerkrankungen",
      config: { frage: "Operationen (welche und wann?)", pflicht: false },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Medizinische Vorgeschichte & Vorerkrankungen",
      config: { frage: "Implantate (Schrittmacher, Metall, Silikon etc.)", pflicht: false },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Medizinische Vorgeschichte & Vorerkrankungen",
      config: { frage: "Gab es in Ihrer Familie relevante Erkrankungen?", pflicht: false },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Medikamente, Allergien & Nahrungsergänzung",
      config: { frage: "Aktuelle Medikamente (inkl. Dosis)", pflicht: false },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Medikamente, Allergien & Nahrungsergänzung",
      config: { frage: "Nahrungsergänzungsmittel", pflicht: false },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Medikamente, Allergien & Nahrungsergänzung",
      config: { frage: "Allergien / Nahrungsmittelunverträglichkeiten", pflicht: false },
    },
    {
      typ: "checkboxen",
      titel: "Detaillierte Symptomanalyse",
      config: {
        fragen: [
          "Erschöpfung / Fatigue",
          "„Brain Fog“ / Nebelgefühl im Kopf",
          "Konzentrations- / Gedächtnisprobleme",
          "Wortfindungsstörungen",
          "Schlafstörungen (Einschlafen / Durchschlafen)",
          "Stimmungsschwankungen / Reizbarkeit",
          "Depression / Ängste / Panikattacken",
          "Kopfschmerzen / Migräne",
          "Schwindel / Benommenheit",
          "Kribbeln / Taubheitsgefühle",
          "Licht- / Geräuschempfindlichkeit",
          "Unerklärliches Fieber / Nachtschweiß",
          "Gewichtsveränderung (Zunahme / Abnahme)",
          "Herzrasen / -stolpern",
          "Brustschmerzen / Engegefühl",
          "Blutdruck (hoch / niedrig) / kalte Hände/Füße",
          "Luftnot (in Ruhe / bei Belastung) / Hustenreiz",
          "Bauchschmerzen / Krämpfe",
          "Blähungen / Völlegefühl",
          "Übelkeit / Erbrechen",
          "Sodbrennen / Reflux",
          "Stuhlveränderung (Verstopfung / Durchfall)",
          "Gelenkschmerzen (wandernd?)",
          "Muskelschmerzen / -zucken",
          "Morgensteifigkeit",
          "Nacken- / Rückenschmerzen",
        ],
        pflicht: false,
      },
    },
    {
      typ: "jaNein",
      titel: "Lebensstil & Umweltfaktoren",
      config: {
        fragen: [
          "Hatten Sie jemals einen Zeckenstich? (Wenn ja, wann? Gab es eine Rötung?)",
          "Haben/Hatten Sie Amalgam-Zahnfüllungen?",
          "Kontakt zu Schimmel in Wohn- oder Arbeitsräumen?",
          "Rauchen Sie?",
          "Trinken Sie regelmäßig Alkohol?",
        ],
        notizFrage: "Erläuterungen (z. B. wann / wie viel):",
        pflicht: false,
      },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Lebensstil & Umweltfaktoren",
      config: {
        frage: "Hatten Sie schwere Infektionen? (z. B. Pfeiffersches Drüsenfieber/EBV, Gürtelrose etc.)",
        pflicht: false,
      },
    },
    {
      typ: "textfeld_schreibfeld",
      titel: "Lebensstil & Umweltfaktoren",
      config: {
        frage: "Berufliche/private Exposition gegenüber Chemikalien, Schwermetallen oder Giften?",
        pflicht: false,
      },
    },
    {
      typ: "skala_1_10",
      titel: "Lebensstil & Umweltfaktoren",
      config: { frage: "Wie würden Sie Ihr allgemeines Stresslevel beschreiben?", pflicht: false },
    },
    {
      typ: "skala_1_10",
      titel: "Lebensstil & Umweltfaktoren",
      config: { frage: "Wie ist Ihre Schlafqualität?", pflicht: false },
    },
    {
      typ: "infotext",
      titel: "Einwilligungserklärung zur Datenverarbeitung (DSGVO)",
      config: {
        text: "Zweck der Datenverarbeitung:\nDie Erhebung und Verarbeitung Ihrer Gesundheitsdaten (Anamnese, Diagnosen, Befunde, Therapiedaten) sowie Ihrer administrativen Daten (Name, Adresse, Kontaktdaten) ist für eine sorgfältige und umfassende Diagnostik, Beratung, Therapieplanung, Behandlung und die damit verbundene Abrechnung unerlässlich.\n\nIhre Rechte & Speicherdauer:\nSie haben jederzeit das Recht auf Auskunft über Ihre gespeicherten Daten. Weiterhin haben Sie das Recht auf Berichtigung, Löschung (sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen), Einschränkung der Verarbeitung sowie das Recht auf Datenübertragbarkeit und Widerspruch. Ihre medizinischen Daten werden gemäß der gesetzlichen Aufbewahrungsfrist von mindestens 10 Jahren nach Abschluss der Behandlung gespeichert.",
        checkboxLabel: "",
        pflicht: false,
      },
    },
    {
      typ: "infotext",
      titel: "Datenweitergabe an das IMTZ (Schweigepflichtsentbindung)",
      config: {
        text: "Alle Ihre Daten unterliegen der ärztlichen Schweigepflicht. Eine Weitergabe an Dritte (z. B. andere Ärzte, Labore) erfolgt nur mit Ihrer ausdrücklichen Zustimmung oder auf gesetzlicher Grundlage.\n\nDie von mir geplanten spezialisierten Therapieverfahren (z. B. Apherese, Hyperthermie, Infusionstherapien) werden in den Räumlichkeiten und mit der Infrastruktur der IMTZ GmbH, Gaußstraße 51, 14480 Potsdam, durchgeführt.\n\nHiermit willigen Sie ein und entbinden mich, den o. g. Behandler, von der ärztlichen Schweigepflicht gegenüber der IMTZ GmbH und ihrem Personal.\n\nDiese Einwilligung ist zwingend erforderlich, damit ich Ihre relevanten medizinischen Daten (Diagnosen, Befunde, Therapieplan) an die IMTZ GmbH weiterleiten kann, um die dortige Planung, Durchführung und Dokumentation Ihrer Behandlung zu ermöglichen. Ohne diese Einwilligung kann eine Behandlung in der IMTZ GmbH nicht stattfinden.",
        checkboxLabel: "Ich willige ein",
        pflicht: true,
      },
    },
    {
      typ: "infotext",
      titel: "Einwilligung",
      config: {
        text: "Ich habe die obenstehenden Informationen zur Kenntnis genommen und verstanden. Ich willige in die Erhebung, Verarbeitung und Speicherung meiner persönlichen und medizinischen Daten im beschriebenen Umfang ein. Insbesondere stimme ich der Weitergabe meiner Daten an die IMTZ GmbH zum Zwecke der Behandlungsplanung und -durchführung ausdrücklich zu. Mir ist bewusst, dass ich diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen kann, eine weitere Behandlung dann aber unter Umständen nicht mehr möglich ist.",
        checkboxLabel: "Ich willige ein",
        pflicht: true,
      },
    },
  ],
};
