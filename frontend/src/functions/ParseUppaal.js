export const parseUppaalQuery = (fileContent) => {
  // 1. Clean up the content (remove comments starting with //)
  const cleanLine = fileContent
    .split("\n")
    .find((line) => line.trim().startsWith("simulate"));

  if (!cleanLine) {
    console.error("No 'simulate' query found.");
    return null;
  }

  // 2. Regex to capture the two main parts:
  // Part 1: Content inside [ ... ] -> (<=TAU; 20)
  // Part 2: Content inside { ... } -> (var1, var2, ...)
  const regex = /simulate\s*\[(.*?)]\s*\{(.*?)\}/;
  const match = cleanLine.match(regex);

  if (!match) {
    console.error("Invalid format. Expected: simulate[...]{...}");
    return null;
  }

  // 3. Extract First Part (Constraints) -> Array
  // Example: "20; <=TAU" -> ["<=TAU", "20"]
  const constraintsRaw = match[1];
  const constraintsArray = constraintsRaw
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s !== "");

  // 4. Extract Second Part (Variables) -> Array
  // Example: "t.temp, t.ON" -> ["t.temp", "t.ON"]
  const variablesRaw = match[2];
  const variablesArray = variablesRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");

  return {
    constraints: constraintsArray,
    variables: variablesArray, // Now returns array instead of object
  };
};
