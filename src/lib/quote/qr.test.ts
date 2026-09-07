import { describe, expect, it } from "vitest";

import { renderPatientQrSvg } from "./qr";

const PATIENT_URL = "https://dentiplan-production.wsternik.workers.dev/p/mw0sKeNdQrvma7UVaLGskg";

describe("renderPatientQrSvg", () => {
  it("renders deterministic square SVG geometry with a four-module quiet zone", () => {
    const first = renderPatientQrSvg(PATIENT_URL);
    const second = renderPatientQrSvg(PATIENT_URL);

    expect(first).toBe(second);
    expect(first).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);

    const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(first);
    expect(viewBox).not.toBeNull();
    expect(viewBox?.[1]).toBe(viewBox?.[2]);

    expect(first).toContain('<rect width="100%" height="100%" fill="#fff"/>');

    const modulePath = /<path d="([^"]+)" fill="#000"\/>/.exec(first);
    expect(modulePath?.[1]).toMatch(/M\d+ \d+h1v1h-1z/);

    const coordinates = [...(modulePath?.[1] ?? "").matchAll(/M(\d+) (\d+)h1v1h-1z/g)];
    const size = Number(viewBox?.[1]);

    expect(coordinates.length).toBeGreaterThan(0);
    expect(Math.min(...coordinates.map((match) => Number(match[1])))).toBeGreaterThanOrEqual(4);
    expect(Math.min(...coordinates.map((match) => Number(match[2])))).toBeGreaterThanOrEqual(4);
    expect(Math.max(...coordinates.map((match) => Number(match[1])))).toBeLessThan(size - 4);
    expect(Math.max(...coordinates.map((match) => Number(match[2])))).toBeLessThan(size - 4);
  });

  it("changes the encoded geometry when the patient URL changes", () => {
    expect(renderPatientQrSvg(PATIENT_URL)).not.toBe(
      renderPatientQrSvg("https://dentiplan-production.wsternik.workers.dev/p/anotherToken"),
    );
  });
});
