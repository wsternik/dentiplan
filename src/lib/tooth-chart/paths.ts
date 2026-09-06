// VENDORED GEOMETRY — the only file in this repo that contains copied bytes.
//
// Source:    react-odontogram, https://github.com/biomathcode/react-odontogram
// Version:   0.5.6 (commit 81b48eb)
// Author:    Copyright (c) biomathcode (Pratik Sharma)
// Licence:   MIT — full notice in THIRD-PARTY-NOTICES.md at the repo root.
//
// Copied verbatim: the eight `outlinePath` strings and their `type` names from
// `src/data.ts` (`teethPaths` — the arch set; `NewTeethPaths` is not copied),
// the four transform strings from `oldquadrants` in `src/utils.ts`, and the
// viewBox returned by `getViewBox("circle", "full")`. Deliberately NOT copied:
// every component, the stylesheet, the theme, the `label` field (two of its four
// values are wrong and all four are English), and `shadowPath` /
// `lineHighlightPath` — this chart draws one path per tooth so that fill,
// outline and hatch stay ours to control.
//
// This file is inert data and carries NO FDI meaning: the transforms are slots
// in draw order, not quadrants. The FDI → slot mapping lives in `layout.ts`,
// which is where the library is wrong and where we are right.

/**
 * A tooth shape, in FDI position order 1–8. Coordinates are absolute within the
 * quadrant, so a shape is also its place on the arch.
 */
export interface ToothShape {
  /** FDI second digit, 1 (central incisor) → 8 (third molar). */
  readonly position: number;
  /** The library's anatomical name for the shape. Data, never displayed. */
  readonly type: string;
  /** SVG path data for the crown outline. */
  readonly outlinePath: string;
}

export const TOOTH_SHAPES: readonly ToothShape[] = [
  {
    position: 1,
    type: "Central Incisor",
    outlinePath:
      "M173.951 1.698c-2.198.16-5.302.862-5.302.862s-5.531 1.025-7.781 2.27c-2.403 1.333-5.553 3.299-6.013 5.258-.432 1.84-.78 4.734-.491 6.832l.027.2c.348 2.527.865 6.28 1.239 10.316.186 2-.101 3.21.751 6.16.895 3.1 1.395 4.573 2.013 5.687.646 1.164 1.493 2.087 2.03 3.28.866 1.924 2.393 4.29 3.87 6.1a48.805 48.805 0 0 0 2.36 2.663c1.016 1.078 2.819 3.11 3.898 4.331 1.526 1.727 3.076 3.248 4.423 3.742 1.217.446 2.709.642 3.793.936 1.369.372 2.494.638 4.597 0 1.545-.468 2.725-.621 4.372-2.424 2.064-2.258 2.846-3.517 3.512-4.746 1.065-1.964 2.524-4.648 3.541-6.422.611-1.068 2.221-3.089 4.086-8.845 1.54-4.752 2.367-7.76 2.731-8.994.415-1.408 1.079-3.583 1.355-6.196.44-4.176 1.114-7.482 1.062-11.026-.044-3.046.104-5.04-1.065-6.306-.95-1.029-1.988-2.001-3.306-2.534-1.959-.79-3.775-1.358-5.298-1.592-1.351-.207-7.05-.35-11.219-.057-1.567.11-3.61.097-9.185.505Z",
  },
  {
    position: 2,
    type: "Lateral Incisor",
    outlinePath:
      "M135.016 60.41c3.443 1.355 7.834 2.73 9.601 2.346 4.185-.91 7.044-4.017 8.123-8.152 2.069-7.927 2.249-16.288 1.995-24.436-.113-3.596.72-16.81-4.184-18.444-8.135-6.14-32.088.494-36.979 8.055-5.013 7.751.878 21.131 5.56 27.728 3.862 5.44 9.714 10.474 15.884 12.903Z",
  },
  {
    position: 3,
    type: "Canine",
    outlinePath:
      "M77.63 64.236c1.692 1.401 15.516 14.583 34.698 16.903 5.569.674 15.058-7.184 15.789-12.89 1.335-10.423-12.444-29.205-21.965-33.703-4.542-2.145-25.892-4.039-28.523 2.939-2.471 6.557-6.596 21.29 0 26.751Z",
  },
  {
    position: 4,
    type: "First Premolar",
    outlinePath:
      "M93.684 108.748c-7.498 3.397-35.368-7.397-35.596-7.441-1.429-.842-12.215-2.854-9.068-29.414.147-1.238 1.353-2.05 2.218-2.556.956-.559 3.157-1.595 7.587-2.794 2.707-.734 13.856-3.54 18.674-.92 2.216 1.206 6.363 4.117 10.473 7.036 4.11 2.919 10.958 8.715 13.327 11.338 2.291 2.537 10.324 13.75-7.615 24.751Z",
  },
  {
    position: 5,
    type: "Second Premolar",
    outlinePath:
      "M33.396 127.652c-1.088-2.713-4.486-11.852-3.962-15.246.477-3.085 14.47-12.008 23.595-12.008 2.178 0 25.157 6.665 35.073 17.908 4.551 9.324-1.624 23.339-16.22 23.339-8.193 0-23.563-1.897-25.453-2.215-1.896-.319-4.317-1.128-6.596-2.321-1.289-.675-2-1.035-2.478-1.647-.655-.84-2.101-3.178-3.96-7.81Z",
  },
  {
    position: 6,
    type: "First Molar",
    outlinePath:
      "M35.539 203.323c-3.363.196-32.788-4.02-28.495-42.465 3.631-20.408 26.21-23.364 29.557-22.912 9.019-.745 25.727 6.743 29.255 9.403 4.546 3.427 7.384 5.681 8.606 7.092 2.436 2.814 4.499 5.11 4.7 6.313.284 1.703 1.317 4.72-2.248 9.687-2.453 3.418-2.957 6.663-2.856 10.223.118 4.185.37 9.754-.524 11.63-.592 1.244-.984 2.627-2.375 3.392-2.015 1.108-4.61 2.317-11.93 3.748-3.623.708-9.309 1.83-12.401 2.292-5.19.777-8.423 1.43-11.289 1.597Z",
  },
  {
    position: 7,
    type: "Second Molar",
    outlinePath:
      "M4.969 248.132c-1.188-2.74-14.708-27.152 12.319-42.139 1.836-1.018 24.508-7.711 45.28 10.874 2.274 2.035 4.455 3.579 5.403 5.102 1.414 2.271 2.128 3.435 1.687 5.606-.387 1.901-1.54 3.642-3.77 7.711-1.127 2.056-1.854 3.427-1.369 7.824.175 1.59.627 3.935.048 6.603-.466 2.147-.941 3.567-2.578 5.006-2.53 2.224-5.307 3.645-9.076 4.35-1.091.204-3.133.811-7.525 1.702-2.776.563-6.619 1.234-10.09 1.654-3.47.42-6.478.638-8.612.636-3.353-.002-6.734.031-9.465-1.48l-.018-.01c-1.654-.915-4.076-2.255-6.245-4.732-2.258-2.579-4.591-5.482-5.989-8.707Z",
  },
  {
    position: 8,
    type: "Third Molar",
    outlinePath:
      "M.895 291.331c-.362-1.218-.116-3.411-.164-3.892-.035-.34.124-3.438.727-5.558 1.04-2.82 1.808-4.74 2.573-5.752 1.413-1.872 3.913-4.769 7.135-7.2 2.288-1.726 5.003-3.187 8.133-4.339 2.249-.828 4.362-1.502 7.732-1.693 2.175-.123 5.25-.155 8.782.108s7.403.804 10.353 1.397 4.92 1.218 6.641 1.893c1.722.675 3.148 1.389 3.972 1.768 1.51.696 2.9 1.209 3.824 2.14 1.857 1.872 2.617 3.334 2.912 4.807.254 1.27.252 3.216-.224 4.531-.672 1.859-1.468 2.856-1.468 5.7 0 3.857 1.713 5.95 1.915 8.356.337 4.008.317 6.168-.42 7.485-.591 1.057-1.532 2.383-5.541 5.088-1.173.791-2.684 1.634-6.643 3.424-2.762 1.248-6.977 3.108-9.205 4.107-2.473 1.109-4.667 2.226-8.234 3.053-2.54.589-5.631.784-9.012.186-2.307-.408-5.449-1.183-9.107-3.827-3.928-2.839-6.53-4.897-7.497-6.041-.866-1.026-1.714-2.082-2.412-3.555-.904-1.905-2.272-3.643-3-5.916-.846-2.633-1.167-4.233-1.772-6.27Z",
  },
];

/**
 * The four quadrant transforms in DRAW ORDER — index 0 upper-left of the image,
 * 1 upper-right, 2 lower-left, 3 lower-right. The untransformed shapes occupy
 * the upper-left half of the viewBox; the other three are mirrors of it.
 */
export const SLOT_TRANSFORMS: readonly [string, string, string, string] = [
  "",
  "scale(-1, 1) translate(-409, 0)",
  "scale(1, -1) translate(0, -694)",
  "scale(-1, -1) translate(-409, -694)",
];

/** `getViewBox("circle", "full")` — the full arch. */
export const CHART_VIEWBOX = "0 0 409 694";
