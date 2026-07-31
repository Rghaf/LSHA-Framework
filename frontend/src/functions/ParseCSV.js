export const parseCSV = (csvText) => {
  const lines = csvText.split("\n").filter((line) => line.trim() !== ""); // Split by line & remove empty ones
  if (lines.length === 0) return [];

  return lines[0]
    .split(",")
    .map((header) => header.trim())
    .filter((header) => header !== "");
};
