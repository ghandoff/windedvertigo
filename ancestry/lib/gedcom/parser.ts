/**
 * GEDCOM 5.5.1 parser
 *
 * parses a .ged file into structured records that can be
 * mapped to our database schema.
 */

export type GedcomLine = {
  level: number;
  xref: string | null;
  tag: string;
  value: string;
};

export type GedcomRecord = {
  xref: string | null;
  tag: string;
  value: string;
  children: GedcomRecord[];
};

/** parse raw gedcom text into a flat list of lines */
function parseLines(text: string): GedcomLine[] {
  const lines: GedcomLine[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // format: LEVEL [XREF] TAG [VALUE]
    const match = trimmed.match(/^(\d+)\s+(?:(@\S+@)\s+)?(\S+)\s*(.*)$/);
    if (!match) continue;

    lines.push({
      level: parseInt(match[1], 10),
      xref: match[2] || null,
      tag: match[3],
      value: match[4] || "",
    });
  }

  return lines;
}

/** build a tree of records from flat lines */
function buildRecords(lines: GedcomLine[]): GedcomRecord[] {
  const root: GedcomRecord[] = [];
  const stack: GedcomRecord[] = [];

  for (const line of lines) {
    const record: GedcomRecord = {
      xref: line.xref,
      tag: line.tag,
      value: line.value,
      children: [],
    };

    // pop stack to find parent at level - 1
    while (stack.length > line.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(record);
    } else {
      stack[stack.length - 1].children.push(record);
    }

    stack.push(record);
  }

  return root;
}

/** find a child record by tag */
function findChild(record: GedcomRecord, tag: string): GedcomRecord | undefined {
  return record.children.find((c) => c.tag === tag);
}

/** find all children with a given tag */
function findChildren(record: GedcomRecord, tag: string): GedcomRecord[] {
  return record.children.filter((c) => c.tag === tag);
}

/** get concatenated text value (handles CONT/CONC) */
function getFullValue(record: GedcomRecord): string {
  let text = record.value;
  for (const child of record.children) {
    if (child.tag === "CONT") text += "\n" + child.value;
    if (child.tag === "CONC") text += child.value;
  }
  return text;
}

// exported types for the parsed data
export type ParsedPerson = {
  xref: string;
  givenNames: string;
  surname: string;
  sex: string;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  isLiving: boolean;
  notes: string | null;
};

export type ParsedFamily = {
  xref: string;
  husbXref: string | null;
  wifeXref: string | null;
  childXrefs: string[];
  marriageDate: string | null;
  marriagePlace: string | null;
};

export type ParsedGedcom = {
  persons: ParsedPerson[];
  families: ParsedFamily[];
};

/** parse a GEDCOM file into persons and families */
export function parseGedcom(text: string): ParsedGedcom {
  const lines = parseLines(text);
  const records = buildRecords(lines);

  const persons: ParsedPerson[] = [];
  const families: ParsedFamily[] = [];

  for (const record of records) {
    if (record.tag === "INDI" && record.xref) {
      const name = findChild(record, "NAME");
      let givenNames = "";
      let surname = "";

      if (name) {
        // GEDCOM name format: "Given /Surname/"
        const nameMatch = name.value.match(/^([^/]*)\/?([^/]*)\/?/);
        if (nameMatch) {
          givenNames = nameMatch[1].trim();
          surname = nameMatch[2].trim();
        }
        // check for structured name parts
        const givn = findChild(name, "GIVN");
        const surn = findChild(name, "SURN");
        if (givn) givenNames = givn.value;
        if (surn) surname = surn.value;
      }

      const sexRec = findChild(record, "SEX");
      const sex = sexRec?.value || "U";

      const birthRec = findChild(record, "BIRT");
      const birthDate = birthRec ? findChild(birthRec, "DATE")?.value ?? null : null;
      const birthPlace = birthRec ? findChild(birthRec, "PLAC")?.value ?? null : null;

      const deathRec = findChild(record, "DEAT");
      const deathDate = deathRec ? findChild(deathRec, "DATE")?.value ?? null : null;
      const deathPlace = deathRec ? findChild(deathRec, "PLAC")?.value ?? null : null;

      // a person is considered living if no death record exists
      const isLiving = !deathRec;

      const noteRec = findChild(record, "NOTE");
      const notes = noteRec ? getFullValue(noteRec) : null;

      persons.push({
        xref: record.xref,
        givenNames,
        surname,
        sex: ["M", "F", "X"].includes(sex) ? sex : "U",
        birthDate,
        birthPlace,
        deathDate,
        deathPlace,
        isLiving,
        notes,
      });
    }

    if (record.tag === "FAM" && record.xref) {
      const husb = findChild(record, "HUSB");
      const wife = findChild(record, "WIFE");
      const children = findChildren(record, "CHIL");

      const marrRec = findChild(record, "MARR");
      const marriageDate = marrRec ? findChild(marrRec, "DATE")?.value ?? null : null;
      const marriagePlace = marrRec ? findChild(marrRec, "PLAC")?.value ?? null : null;

      families.push({
        xref: record.xref,
        husbXref: husb?.value ?? null,
        wifeXref: wife?.value ?? null,
        childXrefs: children.map((c) => c.value),
        marriageDate,
        marriagePlace,
      });
    }
  }

  return { persons, families };
}

/**
 * parse a GEDCOM date string into an ISO date (best effort).
 * handles: "2 OCT 1822", "ABT 1850", "BEF 1900", "BET 1845 AND 1855", "1870"
 */
export function parseGedcomDate(raw: string): { date: string; precision: string; display: string } | null {
  if (!raw) return null;

  const months: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };

  let precision = "exact";
  let cleaned = raw.trim();

  // strip qualifiers
  if (/^ABT\s+/i.test(cleaned)) { precision = "about"; cleaned = cleaned.replace(/^ABT\s+/i, ""); }
  if (/^BEF\s+/i.test(cleaned)) { precision = "before"; cleaned = cleaned.replace(/^BEF\s+/i, ""); }
  if (/^AFT\s+/i.test(cleaned)) { precision = "after"; cleaned = cleaned.replace(/^AFT\s+/i, ""); }
  if (/^EST\s+/i.test(cleaned)) { precision = "about"; cleaned = cleaned.replace(/^EST\s+/i, ""); }
  if (/^CAL\s+/i.test(cleaned)) { precision = "about"; cleaned = cleaned.replace(/^CAL\s+/i, ""); }

  // "2 OCT 1822" or "OCT 1822" or "1822"
  const fullMatch = cleaned.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i);
  if (fullMatch) {
    const day = fullMatch[1].padStart(2, "0");
    const month = months[fullMatch[2].toUpperCase()] ?? "01";
    return { date: `${fullMatch[3]}-${month}-${day}`, precision, display: raw };
  }

  const monthYear = cleaned.match(/^([A-Z]{3})\s+(\d{4})$/i);
  if (monthYear) {
    const month = months[monthYear[1].toUpperCase()] ?? "01";
    return { date: `${monthYear[2]}-${month}-01`, precision: precision === "exact" ? "month" : precision, display: raw };
  }

  const yearOnly = cleaned.match(/^(\d{4})$/);
  if (yearOnly) {
    return { date: `${yearOnly[1]}-01-01`, precision: precision === "exact" ? "year" : precision, display: raw };
  }

  return { date: "0001-01-01", precision: "about", display: raw };
}
