import { chromium } from "playwright-core";

const SCRATCH = process.env.HOME + "/audit_test_files";
const OUT = "/tmp/claude-1000/-home-rghaf-Projects-LSHA-framework/407e6863-638f-408a-afba-727e423aa524/scratchpad";
const consoleErrors = [];

const browser = await chromium.launch({
  executablePath: "/snap/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
page.on("dialog", async (d) => { await d.dismiss(); });

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

await page.goto("http://localhost:5173/form", { waitUntil: "networkidle" });
await page.waitForTimeout(300);

// ---------- Test A: stale variable reset when switching strategy ----------
await page.getByLabel("Custom Case Study Name*").fill("Stale Reset Test");
await page.getByLabel("Resample Strategy of your case study*").selectOption("UPPAAL");
await page.getByLabel("UPPAAL Model file").setInputFiles(`${SCRATCH}/model.xml`);
await page.getByLabel("UPPAAL Query file").setInputFiles(`${SCRATCH}/query.q`);
await page.waitForTimeout(500);
await page.getByRole("button", { name: "Continue to next step" }).click();
await page.waitForTimeout(300);

await page.getByLabel("Driver Signal").selectOption(["t.ON"]);
await page.getByLabel("Main Variable").selectOption("t.temp");
await page.waitForTimeout(200);
await shot("A1-uppaal-variables-selected");

// Go back to page 1, switch strategy to SIM.
await page.getByRole("button", { name: "Back" }).click();
await page.waitForTimeout(300);
await page.getByLabel("Resample Strategy of your case study*").selectOption("SIM");
await page.waitForTimeout(200);
await shot("A2-switched-to-sim-model-uppaal-boxes-gone");

// The UPPAAL file boxes should now be gone (strategy switched); CSV box shown instead.
const csvBox = page.getByLabel("CSV file");
await csvBox.setInputFiles({ name: "data.csv", mimeType: "text/csv", buffer: Buffer.from("colA,colB\n1,2\n") });
await page.waitForTimeout(500);

const continueBtn = page.getByRole("button", { name: "Continue to next step" });
await continueBtn.click();
await page.waitForTimeout(300);
await shot("A3-formpage2-after-strategy-switch");

const driverVal = await page.getByLabel("Driver Signal").inputValue().catch(() => "(multi-select, checking selected options)");
const mainVal = await page.getByLabel("Main Variable").inputValue();
console.log("Main Variable value after switching strategy (should be empty/placeholder, NOT 't.temp'):", JSON.stringify(mainVal));
const driverSelected = await page.getByLabel("Driver Signal").locator("option:checked").allTextContents();
console.log("Driver Signal selected options after switch (should be empty array):", JSON.stringify(driverSelected));
const options = await page.getByLabel("Driver Signal").locator("option").allTextContents();
console.log("Driver Signal available options now (should be CSV columns colA/colB, not t.ON):", JSON.stringify(options));

// ---------- Test B: File box display clears after Reset ----------
// Navigate home via client-side link, then back to /form to trigger the resume dialog.
await page.getByRole("link", { name: "POLMI" }).click();
await page.waitForTimeout(300);
await page.getByRole("link", { name: "Start Customizing the Algorithm" }).click();
await page.waitForTimeout(400);
await shot("B1-resume-dialog");

const restartBtn = page.getByRole("button", { name: "Cancel & Restart" });
const dialogVisible = await restartBtn.isVisible().catch(() => false);
console.log("Resume dialog appeared:", dialogVisible);
if (dialogVisible) {
  await restartBtn.click();
  await page.waitForTimeout(300);
}
await shot("B2-after-restart-should-be-blank-name-and-no-file-selected-text");

const nameVal = await page.getByLabel("Custom Case Study Name*").inputValue();
console.log("Name field after restart (should be empty):", JSON.stringify(nameVal));

console.log("CONSOLE_ERRORS:", JSON.stringify(consoleErrors, null, 2));
await browser.close();
