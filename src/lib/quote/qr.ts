import { qrcode } from "qrcode-generator";

const QUIET_ZONE_MODULES = 4;

export function renderPatientQrSvg(patientUrl: string): string {
  const code = qrcode(0, "M");
  code.addData(patientUrl, "Byte");
  code.make();

  const moduleCount = code.getModuleCount();
  const size = moduleCount + QUIET_ZONE_MODULES * 2;
  const darkModules: string[] = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (code.isDark(row, column)) {
        darkModules.push(`M${column + QUIET_ZONE_MODULES} ${row + QUIET_ZONE_MODULES}h1v1h-1z`);
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    '<rect width="100%" height="100%" fill="#fff"/>',
    `<path d="${darkModules.join("")}" fill="#000"/>`,
    "</svg>",
  ].join("");
}
