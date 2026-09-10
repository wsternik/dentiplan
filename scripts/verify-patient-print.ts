import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";

import { chromium, type Locator, type Page } from "@playwright/test";

const A4_WIDTH_MM = 210;
const PAGE_MARGIN_MM = 15;
const CSS_PX_PER_MM = 96 / 25.4;
const A4_PRINTABLE_WIDTH = Math.round((A4_WIDTH_MM - 2 * PAGE_MARGIN_MM) * CSS_PX_PER_MM);
const CSS_PX_PER_CM = 96 / 2.54;
const EXPECTED_QR_SIZE = 2.5 * CSS_PX_PER_CM;
const EDGE_TOLERANCE = 5;
const QR_TOLERANCE = 2;

function usage(): never {
  throw new Error(
    "Usage: node --import tsx scripts/verify-patient-print.ts <absolute-patient-url> <absolute-output-path>",
  );
}

function patientUrl(value: string | undefined): URL {
  if (value === undefined) usage();

  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || !url.pathname.startsWith("/p/")) {
    throw new Error("The first argument must be an absolute HTTP(S) patient URL under /p/.");
  }
  return url;
}

function outputPath(value: string | undefined): string {
  if (value === undefined || !isAbsolute(value)) {
    throw new Error("The PDF output path must be absolute.");
  }
  return value;
}

async function requiredBox(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`${label} is not laid out on the printed page.`);
  return box;
}

async function assertText(page: Page, text: string) {
  const locator = page.getByText(text, { exact: true });
  if ((await locator.count()) === 0 || !(await locator.first().isVisible())) {
    throw new Error(`Required printed text is missing: ${text}`);
  }
}

const url = patientUrl(process.argv[2]);
const pdfPath = outputPath(process.argv[3]);
await mkdir(dirname(pdfPath), { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: A4_PRINTABLE_WIDTH, height: 1000 } });
  await page.emulateMedia({ media: "print" });

  const response = await page.goto(url.toString(), { waitUntil: "networkidle" });
  if (!response?.ok()) {
    throw new Error(`Patient page returned ${response?.status() ?? "no response"}.`);
  }

  const standard = page.getByRole("heading", { name: "Leczenie w kilku wizytach" });
  const anesthesia = page.getByRole("heading", { name: "Leczenie w narkozie (jedna sesja)" });
  const standardBox = await requiredBox(standard, "Standard variant");
  const anesthesiaBox = await requiredBox(anesthesia, "Anaesthesia variant");

  if (Math.abs(standardBox.y - anesthesiaBox.y) >= EDGE_TOLERANCE) {
    throw new Error("Treatment variants do not share a top edge at the A4 printable width.");
  }
  if (anesthesiaBox.x - standardBox.x <= 100) {
    throw new Error("Treatment variants are not laid out side by side.");
  }

  for (const text of ["w planie", "poza bieżącym planem", "niepewne"]) {
    await assertText(page, text);
  }

  const footer = page.locator("#patient-print-footer");
  const footerBox = await requiredBox(footer, "Print footer");
  const qrBox = await requiredBox(footer.locator(".patient-print-qr"), "Print QR code");
  const onlineAddress = footer.getByText(/^Wersja online: https?:\/\//);
  const addressBox = await requiredBox(onlineAddress, "Full online address");

  for (const [dimension, actual] of [
    ["width", qrBox.width],
    ["height", qrBox.height],
  ] as const) {
    if (Math.abs(actual - EXPECTED_QR_SIZE) > QR_TOLERANCE) {
      throw new Error(
        `QR ${dimension} is ${actual.toFixed(2)}px; expected approximately ${EXPECTED_QR_SIZE.toFixed(2)}px.`,
      );
    }
  }

  const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const horizontalBounds = [footerBox, qrBox, addressBox].every(
    (box) => box.x >= -0.5 && box.x + box.width <= pageWidth + 0.5,
  );
  if (!horizontalBounds) throw new Error("The print footer, QR, or full online address exceeds the printable width.");

  const overflowsHorizontally = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  if (overflowsHorizontally) throw new Error("The patient document overflows the A4 printable width.");

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: false,
    preferCSSPageSize: true,
  });

  process.stdout.write(`A4 patient PDF verified: ${pdfPath}\n`);
} finally {
  await browser.close();
}
