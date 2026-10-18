// RFC4180-ish single-line splitter: honours double-quoted fields (so commas
// and escaped quotes inside quotes don't break column alignment — needed for
// GREEN's older SCADA export template, e.g. "DecanterMB","Coppia","0",...).
// Does not handle embedded newlines inside a quoted field; none of the
// datasets this app supports need that.
function splitCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function splitLines(csvText) {
  return (csvText || "").split("\n").filter((line) => line.trim() !== "");
}

// Wide format: each column IS a variable — just the header row.
export const parseCSV = (csvText) => {
  const lines = splitLines(csvText);
  if (lines.length === 0) return [];
  return splitCsvLine(lines[0]).filter((header) => header !== "");
};

// Long format: variable names are VALUES inside one column (default
// "DataObjectField"), not headers — e.g. GREEN's
// DataObjectName/DataObjectField/Value/TimeStamp SCADA dumps. Returns the
// sorted, de-duplicated set of values found in that column.
export const parseCSVLongFormatFields = (csvText, fieldColumn = "DataObjectField") => {
  const lines = splitLines(csvText);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]);
  const idx = header.findIndex((h) => h === fieldColumn);
  if (idx === -1) return [];

  const values = new Set();
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const value = cells[idx];
    if (value) values.add(value);
  }
  return Array.from(values).sort();
};
