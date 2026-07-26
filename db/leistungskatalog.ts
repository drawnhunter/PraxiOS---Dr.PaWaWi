// Leistungskatalog IMTZ — Stand: Preisliste EK&VK 2026 (mit Preisen und Import-Aliasen).
// Wird beim ersten Start automatisch geseedet, wenn der Katalog leer ist.
export const LEISTUNGSKATALOG: {
  name: string; beschreibung: string | null; einheit: string; preisNetto: string;
  ekPreisNetto: string | null; kategorie: "leistung" | "auslage"; importNamen: string | null; ustSatz: number;
}[] = [
  {
    "name": "EECP (Enhanced External Counterpulsation)",
    "beschreibung": "§ 2 GOÄ",
    "einheit": "Stück",
    "preisNetto": "110.00",
    "ekPreisNetto": null,
    "kategorie": "leistung",
    "importNamen": "EECP",
    "ustSatz": 0
  },
  {
    "name": "Wasserstoff-Inhalationstherapie",
    "beschreibung": "§ 2 GOÄ",
    "einheit": "Stück",
    "preisNetto": "80.00",
    "ekPreisNetto": null,
    "kategorie": "leistung",
    "importNamen": "Wasserstoff Inh.;Wasserstoff-Inhalation;H2-Inhalation",
    "ustSatz": 0
  },
  {
    "name": "mGKHT — moderate Ganzkörperhyperthermie",
    "beschreibung": "Entspr. GOÄ 532",
    "einheit": "Stück",
    "preisNetto": "50.00",
    "ekPreisNetto": null,
    "kategorie": "leistung",
    "importNamen": "mGKHT",
    "ustSatz": 0
  },
  {
    "name": "Ozon-Eigenbluttherapie, groß",
    "beschreibung": "Aderlass mit Reinfusion (entspr. GOÄ 285/286A)",
    "einheit": "Stück",
    "preisNetto": "350.00",
    "ekPreisNetto": null,
    "kategorie": "leistung",
    "importNamen": "Orzon;Ozon-Eigenblut;Ozon Eigenblut",
    "ustSatz": 0
  },
  {
    "name": "HHH — Hypertherme, hyperoxygenierte Hämoperfusion",
    "beschreibung": "Inkl. ärztlicher Durchführung, Überwachung und Gerätetechnik (§ 2 GOÄ)",
    "einheit": "Stück",
    "preisNetto": "6700.00",
    "ekPreisNetto": null,
    "kategorie": "leistung",
    "importNamen": "HHH;Hämoperfusion",
    "ustSatz": 0
  },
  {
    "name": "Kombinations-Apherese (Plasmafilter + Adsorber)",
    "beschreibung": "Inkl. ärztlicher Durchführung, Überwachung und Gerätetechnik (§ 2 GOÄ)",
    "einheit": "Stück",
    "preisNetto": "6800.00",
    "ekPreisNetto": null,
    "kategorie": "leistung",
    "importNamen": "Kombipherese;Apherese;Kombinations-Apherese",
    "ustSatz": 0
  },
  {
    "name": "Infusionstherapie je Behandlungstag",
    "beschreibung": "Anti-inflammatorisch / regenerativ (GOÄ 272)",
    "einheit": "Stück",
    "preisNetto": "250.00",
    "ekPreisNetto": null,
    "kategorie": "leistung",
    "importNamen": "Infusionstherapie",
    "ustSatz": 0
  },
  {
    "name": "Auswertung Vorbefunde, Anamnese, Therapieplanung (GOÄ 34)",
    "beschreibung": "Umfassende Auswertung der Vorbefunde, Anamnese, Therapieplanung und Aufklärung",
    "einheit": "Stück",
    "preisNetto": "220.00",
    "ekPreisNetto": null,
    "kategorie": "leistung",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Abschlussuntersuchung mit Arztbrief",
    "beschreibung": "Abschlussuntersuchung, Erstellung des Arztbriefes (GOÄ 75/85)",
    "einheit": "Stück",
    "preisNetto": "150.00",
    "ekPreisNetto": null,
    "kategorie": "leistung",
    "importNamen": "Abschlussuntersuchung",
    "ustSatz": 0
  },
  {
    "name": "Energy Basis",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "178.92",
    "ekPreisNetto": "63.90",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Vitamin B-Komplex",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "15.37",
    "ekPreisNetto": "5.49",
    "kategorie": "auslage",
    "importNamen": "Vit. B Kompl;B Komplex",
    "ustSatz": 0
  },
  {
    "name": "AOCT",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "22.40",
    "ekPreisNetto": "8.00",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Elektrolyt",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "12.32",
    "ekPreisNetto": "4.40",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Dimaval",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "100.97",
    "ekPreisNetto": "36.06",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Eumetabol (Glutathion) 1200 mg",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "78.12",
    "ekPreisNetto": "27.90",
    "kategorie": "auslage",
    "importNamen": "Eumetabol(Glutathion) 1200mg;Eumetabol;Glutathion 1200",
    "ustSatz": 0
  },
  {
    "name": "Glutathion TAD600",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "50.40",
    "ekPreisNetto": "18.00",
    "kategorie": "auslage",
    "importNamen": "TAD600;Glutathion TAD 600",
    "ustSatz": 0
  },
  {
    "name": "Pascorbin 7,5 g",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "41.94",
    "ekPreisNetto": "14.98",
    "kategorie": "auslage",
    "importNamen": "Pascorbin;Pascorbin 7,5",
    "ustSatz": 0
  },
  {
    "name": "Vitamin C 7,5 g",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "25.14",
    "ekPreisNetto": "8.98",
    "kategorie": "auslage",
    "importNamen": "Vitamin C 7,5;Vitamin C 7.5 g",
    "ustSatz": 0
  },
  {
    "name": "Vitamin C 25 g",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "56.00",
    "ekPreisNetto": "20.00",
    "kategorie": "auslage",
    "importNamen": "Vit. C 25g;Vitamin C 25g",
    "ustSatz": 0
  },
  {
    "name": "Natriumbicarbonat 100 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "15.15",
    "ekPreisNetto": "5.41",
    "kategorie": "auslage",
    "importNamen": "100 ml NaBic;100ml NaBic;NaBi;NaBic;NaBi 100 ml",
    "ustSatz": 0
  },
  {
    "name": "NabiC 250 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "22.40",
    "ekPreisNetto": "8.00",
    "kategorie": "auslage",
    "importNamen": "NabiC;NaBi 250 ml",
    "ustSatz": 0
  },
  {
    "name": "NaBi 20 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "3.50",
    "ekPreisNetto": "1.25",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "ATP-Konzentrat",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "39.20",
    "ekPreisNetto": "14.00",
    "kategorie": "auslage",
    "importNamen": "ATP Konzentrat;ATP",
    "ustSatz": 0
  },
  {
    "name": "L-Carnitin",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "14.00",
    "ekPreisNetto": "5.00",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Kalium-Magnesium",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "6.75",
    "ekPreisNetto": "2.41",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "L-Lysin 1 Amp. (2 g)",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "19.60",
    "ekPreisNetto": "7.00",
    "kategorie": "auslage",
    "importNamen": "L-Lysin;Lysin;L-Lysin 2G",
    "ustSatz": 0
  },
  {
    "name": "L-Lysin ½ Amp.",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "3.50",
    "ekPreisNetto": "3.50",
    "kategorie": "auslage",
    "importNamen": "L-Lysin ½ Amp;L-Lysin 1/2 Amp.",
    "ustSatz": 0
  },
  {
    "name": "L-Carnosin",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "13.52",
    "ekPreisNetto": "4.83",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Artesunat 250 mg",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "154.00",
    "ekPreisNetto": "55.00",
    "kategorie": "auslage",
    "importNamen": "Artesunat;Artesunat 250mg",
    "ustSatz": 0
  },
  {
    "name": "Artesunat 150 mg",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "126.00",
    "ekPreisNetto": "45.00",
    "kategorie": "auslage",
    "importNamen": "Artesunat 150mg",
    "ustSatz": 0
  },
  {
    "name": "Artesunat 100 mg",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "84.00",
    "ekPreisNetto": "30.00",
    "kategorie": "auslage",
    "importNamen": "Artesunat 100mg",
    "ustSatz": 0
  },
  {
    "name": "Vitamin B6",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "11.20",
    "ekPreisNetto": "4.00",
    "kategorie": "auslage",
    "importNamen": "Vit B6",
    "ustSatz": 0
  },
  {
    "name": "Vitamin B12",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "11.20",
    "ekPreisNetto": "4.00",
    "kategorie": "auslage",
    "importNamen": "Vit B12",
    "ustSatz": 0
  },
  {
    "name": "5-MTHF",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "12.60",
    "ekPreisNetto": "4.50",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Prolin-Lysin",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "23.97",
    "ekPreisNetto": "8.56",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Magnesium Diasporal 2 mmol",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "7.00",
    "ekPreisNetto": "2.50",
    "kategorie": "auslage",
    "importNamen": "Magnesium 2mmol;Magnesium 2 mmol;2mmol Mg",
    "ustSatz": 0
  },
  {
    "name": "Magnesium Diasporal 4 mmol",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "7.56",
    "ekPreisNetto": "2.70",
    "kategorie": "auslage",
    "importNamen": "Magnesium 4 mmol;Magnesium 4mmol;4mmol Mg;Magnesium Diasporal",
    "ustSatz": 0
  },
  {
    "name": "NeuroBion",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "10.25",
    "ekPreisNetto": "3.66",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Traumeel",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "7.56",
    "ekPreisNetto": "2.70",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Curcumin 150 mg",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "277.20",
    "ekPreisNetto": "99.00",
    "kategorie": "auslage",
    "importNamen": "Curcumin;Cucumin;150mg Curcumin;Curcumin 150mg",
    "ustSatz": 0
  },
  {
    "name": "Zentramin",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "9.77",
    "ekPreisNetto": "3.49",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "CA-EDTA",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "27.66",
    "ekPreisNetto": "9.88",
    "kategorie": "auslage",
    "importNamen": "CA EDTA;Ca-EDTA",
    "ustSatz": 0
  },
  {
    "name": "DMSO 1 Amp.",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "55.72",
    "ekPreisNetto": "19.90",
    "kategorie": "auslage",
    "importNamen": "DMSO",
    "ustSatz": 0
  },
  {
    "name": "Alpha-Liponsäure 600 mg",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "25.17",
    "ekPreisNetto": "8.99",
    "kategorie": "auslage",
    "importNamen": "Alpha-Liponsäure;Alphaliponsäure 600 mg;Alpha-Liponsäure 600mg",
    "ustSatz": 0
  },
  {
    "name": "Resveratrol",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "728.00",
    "ekPreisNetto": "260.00",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Protokoll N",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "139.97",
    "ekPreisNetto": "49.99",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "MediVitan 1 Amp.",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "21.00",
    "ekPreisNetto": "7.50",
    "kategorie": "auslage",
    "importNamen": "MediVitan;Redivitan 1 Amp.;Redivitan",
    "ustSatz": 0
  },
  {
    "name": "NaCl 0,9 % 100 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "5.00",
    "ekPreisNetto": "5.00",
    "kategorie": "auslage",
    "importNamen": "100 ml NaCl;100ml NaCl;NaCL 100",
    "ustSatz": 0
  },
  {
    "name": "NaCl 0,9 % 250 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "5.00",
    "ekPreisNetto": "5.00",
    "kategorie": "auslage",
    "importNamen": "250 ml NaCl;250ml NaCl;250 ml NaCl 0.9%;250ml NaCl 0.9%;NaCL 250",
    "ustSatz": 0
  },
  {
    "name": "NaCl 0,9 % 500 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "6.50",
    "ekPreisNetto": "6.50",
    "kategorie": "auslage",
    "importNamen": "500 ml NaCl;500ml NaCl;NaCL 500",
    "ustSatz": 0
  },
  {
    "name": "Ringer-Lösung 1000 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "7.00",
    "ekPreisNetto": "7.00",
    "kategorie": "auslage",
    "importNamen": "1000 ml Ringer;Ringer 1000",
    "ustSatz": 0
  },
  {
    "name": "Ringer-Lösung 500 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "6.50",
    "ekPreisNetto": "6.50",
    "kategorie": "auslage",
    "importNamen": "500 ml Ringer;500ml Ringer;Ringer 500",
    "ustSatz": 0
  },
  {
    "name": "Ringer-Lösung 250 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "5.00",
    "ekPreisNetto": "5.00",
    "kategorie": "auslage",
    "importNamen": "250 ml Ringer;250ml Ringer;Ringer-Laktat 250 ml;250 ml Ringer-Laktat",
    "ustSatz": 0
  },
  {
    "name": "Mannit",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "21.00",
    "ekPreisNetto": "21.00",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Clindamycin 600 mg",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "22.18",
    "ekPreisNetto": "7.92",
    "kategorie": "auslage",
    "importNamen": "Clindamycin;600mg Clindamycin;Clindamycin 600mg",
    "ustSatz": 0
  },
  {
    "name": "Phosphatidylcholin",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "36.40",
    "ekPreisNetto": "13.00",
    "kategorie": "auslage",
    "importNamen": "Phosphordycholin",
    "ustSatz": 0
  },
  {
    "name": "Methylenblau 50 mg/10 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "189.20",
    "ekPreisNetto": "67.57",
    "kategorie": "auslage",
    "importNamen": "Methylen Blau 50mg/10ml;Methylenblau;Methylenblau Amp.;Methylenblau 1 Amp.",
    "ustSatz": 0
  },
  {
    "name": "Vaso Aktiv",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "111.72",
    "ekPreisNetto": "39.90",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Cernevit 1 Amp.",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "86.27",
    "ekPreisNetto": "30.81",
    "kategorie": "auslage",
    "importNamen": "Cernevit",
    "ustSatz": 0
  },
  {
    "name": "Azithromycin 500 mg",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "88.40",
    "ekPreisNetto": "31.57",
    "kategorie": "auslage",
    "importNamen": "Azithromycin;Azithromycin 500mg",
    "ustSatz": 0
  },
  {
    "name": "Ceftriaxon 2 g",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "42.78",
    "ekPreisNetto": "15.28",
    "kategorie": "auslage",
    "importNamen": "CefTriaxon;Ceftriaxon;CefTriaxon 2000",
    "ustSatz": 0
  },
  {
    "name": "Metronidazol 500 mg",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "14.50",
    "ekPreisNetto": "5.18",
    "kategorie": "auslage",
    "importNamen": "Metronidazol",
    "ustSatz": 0
  },
  {
    "name": "Vitalipid 1 Amp.",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "35.76",
    "ekPreisNetto": "12.77",
    "kategorie": "auslage",
    "importNamen": "Vitalipid",
    "ustSatz": 0
  },
  {
    "name": "Doxycyclin 100 mg",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "15.04",
    "ekPreisNetto": "5.37",
    "kategorie": "auslage",
    "importNamen": "Doxycyclin;Doxycyclin 100mg",
    "ustSatz": 0
  },
  {
    "name": "Selen 900 µg 1 Amp.",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "38.92",
    "ekPreisNetto": "13.90",
    "kategorie": "auslage",
    "importNamen": "Selen 900ug;Selen 1 Amp.;Selen",
    "ustSatz": 0
  },
  {
    "name": "Bosvene 5 mg",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "417.20",
    "ekPreisNetto": "149.00",
    "kategorie": "auslage",
    "importNamen": "Bosvene 5mg",
    "ustSatz": 0
  },
  {
    "name": "Bosvene 10 mg",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "770.00",
    "ekPreisNetto": "275.00",
    "kategorie": "auslage",
    "importNamen": "Bosvene;Bosvene 10mg",
    "ustSatz": 0
  },
  {
    "name": "Hepa-Merz 1 Amp.",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "56.50",
    "ekPreisNetto": "20.18",
    "kategorie": "auslage",
    "importNamen": "Hepa Merz;Hepa Merz 1 Amp.",
    "ustSatz": 0
  },
  {
    "name": "Alpha-Lipon 50 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "30.80",
    "ekPreisNetto": "11.00",
    "kategorie": "auslage",
    "importNamen": "Alphalipogamma 50ml Amp.;Alpha-Lipon 50ml",
    "ustSatz": 0
  },
  {
    "name": "Neuro-Amino 1 Amp.",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "137.20",
    "ekPreisNetto": "49.00",
    "kategorie": "auslage",
    "importNamen": "Neuro Amino;Neuro-Amino",
    "ustSatz": 0
  },
  {
    "name": "Neuro-Amino ½ Amp.",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "24.50",
    "ekPreisNetto": "24.50",
    "kategorie": "auslage",
    "importNamen": "Neuro-Amino ½ Amp;Neuro-Amino 1/2 Amp.",
    "ustSatz": 0
  },
  {
    "name": "Procain 2 %",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "2.52",
    "ekPreisNetto": "0.90",
    "kategorie": "auslage",
    "importNamen": "Procain 2 % Amp.;Procain 2%;Procain 1%",
    "ustSatz": 0
  },
  {
    "name": "Phospholipid",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "28.00",
    "ekPreisNetto": "10.00",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Eumetabol Immune",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "235.20",
    "ekPreisNetto": "84.00",
    "kategorie": "auslage",
    "importNamen": null,
    "ustSatz": 0
  },
  {
    "name": "Soluvit",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "57.29",
    "ekPreisNetto": "20.46",
    "kategorie": "auslage",
    "importNamen": "SoluVit",
    "ustSatz": 0
  },
  {
    "name": "Glucose 5 % 250 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "5.00",
    "ekPreisNetto": "5.00",
    "kategorie": "auslage",
    "importNamen": "250 ml G5;250ml G5",
    "ustSatz": 0
  },
  {
    "name": "Glucose 5 % 500 ml",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "7.00",
    "ekPreisNetto": "7.00",
    "kategorie": "auslage",
    "importNamen": "500 ml G5;500ml G5%;500 ml G5%",
    "ustSatz": 0
  },
  {
    "name": "Vitalipid ½ Amp.",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "6.39",
    "ekPreisNetto": "6.39",
    "kategorie": "auslage",
    "importNamen": "Vitalipid ½ Amp;Vitalipid 1/2 Amp.",
    "ustSatz": 0
  },
  {
    "name": "Adsorber Jafron HA380",
    "beschreibung": null,
    "einheit": "Stück",
    "preisNetto": "773.50",
    "ekPreisNetto": "773.50",
    "kategorie": "auslage",
    "importNamen": "Jafron HA380;Adsorber",
    "ustSatz": 0
  }
];
