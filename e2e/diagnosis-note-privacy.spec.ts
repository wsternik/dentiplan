// Risk #13 (`context/foundation/test-plan.md`): the raw diagnosis note is useful
// to the authenticated dentist after saving, but it must never cross either
// anonymous patient surface: the rendered `/p/<token>` response or the
// `get_quote_by_token` RPC response that supplies it.
//
// This test proves both halves against one persisted, approved quote. It first
// reopens the draft and approved admin views to show that the note really reached
// its dedicated column; absence from the patient responses therefore cannot pass
// merely because the note was never saved.

import { expect, test } from "@playwright/test";

import { patientUrlFromQr, waitForIslands } from "./support/app";

test("risk #13: a persisted diagnosis note stays in the admin panel and out of patient responses", async ({
  page,
  browser,
}) => {
  const stamp = Date.now();
  const patientEmail = `e2e-note-${stamp}@example.test`;
  const diagnosisNote = `E2E-NOTATKA-POUFNA-${stamp}\nNie udostępniać pacjentowi.`;

  await page.goto("/admin/quotes/new");
  await waitForIslands(page);
  await page.getByRole("button", { name: "Dostosuj formularz ręcznie" }).click();

  await page.getByLabel(/Tylko do Twojej referencji/).fill(patientEmail);
  await page.getByLabel(/Pole robocze/).fill(diagnosisNote);

  const generalPicker = page.getByRole("combobox", { name: "Dodaj pozycję ogólną…" });
  const varnishValue = await generalPicker.getByRole("option", { name: /^Lakierowanie/ }).getAttribute("value");
  await generalPicker.selectOption(varnishValue ?? "");

  await page.getByRole("button", { name: "Zapisz szkic" }).click();
  await expect(page.getByText(/^Zapisano /)).toBeVisible();

  await page.goto("/admin");
  await waitForIslands(page);
  const draftRow = page.getByRole("row").filter({ hasText: patientEmail });
  await expect(draftRow).toHaveCount(1);
  await draftRow.getByRole("link").click();
  await waitForIslands(page);
  await expect(page.getByLabel(/Pole robocze/)).toHaveValue(diagnosisNote);

  await page.getByRole("button", { name: "Zatwierdź" }).click();
  await expect(page.getByRole("heading", { name: "Kosztorys zatwierdzony" })).toBeVisible();
  const patientUrl = await patientUrlFromQr(page);

  await page.goto("/admin");
  await waitForIslands(page);
  const approvedRow = page.getByRole("row").filter({ hasText: patientEmail });
  await expect(approvedRow).toHaveCount(1);
  await approvedRow.getByRole("link").click();
  await waitForIslands(page);
  await expect(page.getByText(diagnosisNote, { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);

  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const anonymousPage = await anonymous.newPage();
    const patientResponse = await anonymousPage.goto(patientUrl);
    expect(await anonymous.cookies()).toHaveLength(0);
    expect(patientResponse?.status()).toBe(200);

    const patientBody = (await patientResponse?.text()) ?? "";
    expect(patientBody).not.toContain(diagnosisNote);
    expect(patientBody).not.toContain(`E2E-NOTATKA-POUFNA-${stamp}`);

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    expect(supabaseUrl, "SUPABASE_URL is required for the anonymous RPC privacy probe").toBeTruthy();
    expect(supabaseKey, "SUPABASE_KEY is required for the anonymous RPC privacy probe").toBeTruthy();

    const token = new URL(patientUrl, "http://localhost:4321").pathname.split("/").at(-1);
    expect(token).toBeTruthy();
    const rpcResponse = await anonymous.request.post(`${supabaseUrl}/rest/v1/rpc/get_quote_by_token`, {
      headers: {
        apikey: supabaseKey ?? "",
        Authorization: `Bearer ${supabaseKey ?? ""}`,
      },
      data: { p_token: token },
    });
    expect(rpcResponse.status()).toBe(200);

    const rpcBody = await rpcResponse.text();
    expect(rpcBody).not.toContain(diagnosisNote);
    expect(rpcBody).not.toContain(`E2E-NOTATKA-POUFNA-${stamp}`);
    expect(rpcBody).not.toContain("diagnosis_note");
    expect(JSON.parse(rpcBody)).toHaveLength(1);
  } finally {
    await anonymous.close();
  }
});
