import { chromium } from "playwright-core";

const SCRATCH = process.env.HOME + "/audit_test_files";
const OUT = "/tmp/claude-1000/-home-rghaf-Projects-LSHA-framework/407e6863-638f-408a-afba-727e423aa524/scratchpad";
const consoleErrors = [];

const browser = await chromium.launch({
  executablePath: "/snap/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
page.on("dialog", async (d) => { await d.dismiss(); });

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

// ---------- Fresh start ----------
await page.goto("http://localhost:5173/form", { waitUntil: "networkidle" });
await page.waitForTimeout(400);

const restartBtn = page.getByRole("button", { name: "Cancel & Restart" });
if (await restartBtn.isVisible().catch(() => false)) {
  await restartBtn.click();
  await page.waitForTimeout(300);
}

// ---------- FormPage1 ----------
await page.getByLabel("Custom Case Study Name*").fill("Audit Test CS");
await page.getByLabel("Resample Strategy of your case study*").selectOption("UPPAAL");
await page.waitForTimeout(200);

await page.getByLabel("UPPAAL Model file").setInputFiles(`${SCRATCH}/model.xml`);
await page.getByLabel("UPPAAL Query file").setInputFiles(`${SCRATCH}/query.q`);
await page.waitForTimeout(500);
await shot("01-formpage1-filled");

const continue1 = page.getByRole("button", { name: "Continue to next step" });
console.log("Page1 continue disabled attr:", await continue1.getAttribute("disabled"));
await continue1.click();
await page.waitForTimeout(400);

// ---------- FormPage2 ----------
await shot("02-formpage2-initial");
const driverSelect = page.getByLabel("Driver Signal");
await driverSelect.selectOption(["t.ON"]);
await page.waitForTimeout(200);
await page.getByLabel("Main Variable").selectOption("t.temp");
await page.waitForTimeout(200);
await page.getByLabel("Context Variable").selectOption(["r.open"]);
await page.waitForTimeout(300);
await shot("03-formpage2-selected");

const continue2 = page.getByRole("button", { name: "Continue to next step" });
console.log("Page2 continue disabled attr (should be null/enabled):", await continue2.getAttribute("disabled"));

// Empty-array validation fix check: deselect driver signal entirely.
await driverSelect.selectOption([]);
await page.waitForTimeout(300);
console.log("Page2 continue disabled attr AFTER clearing driver signal (should be present/true):", await continue2.getAttribute("disabled"));
await shot("04-formpage2-driver-cleared-should-be-disabled");

await driverSelect.selectOption(["t.ON"]);
await page.waitForTimeout(300);
await continue2.click();
await page.waitForTimeout(400);

// ---------- FormPage3 ----------
await page.locator("textarea").fill('{"events": [], "models": [], "variables": []}');
await page.waitForTimeout(300);
await shot("05-formpage3");
await page.getByRole("button", { name: "Continue to next step" }).click();
await page.waitForTimeout(400);

// ---------- FormPage4 ----------
const htQueryTypeSelect = page.getByLabel("HT Query Type");
const htValue = await htQueryTypeSelect.inputValue();
console.log("FormPage4 HT Query Type select value (should be 'S'):", htValue);
await shot("06-formpage4");
await page.getByRole("button", { name: "Continue to next step" }).click();
await page.waitForTimeout(400);

// ---------- FormPage5 (summary) ----------
await shot("07-formpage5-summary");

// ---------- Submit ----------
await page.getByRole("button", { name: "Run The Algorithm" }).click();
await page.waitForTimeout(2500);
await shot("08-after-submit");

const url = page.url();
console.log("URL after submit:", url);

console.log("CONSOLE_ERRORS:", JSON.stringify(consoleErrors, null, 2));
await browser.close();
