/**
 * Disease "assessment" placeholder.
 *
 * No image analysis happens here: the uploaded image is validated and then
 * discarded, and a fixed, clearly-labelled illustrative result is returned.
 * Replace `assess` with a call to a vetted model/service to make it real.
 */

const SIGNATURES = [
  { type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png",
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    type: "image/webp",
    test: (b) =>
      b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

/** True when the buffer's magic bytes really are a JPEG, PNG or WebP image. */
export function looksLikeImage(buffer) {
  return buffer.length > 12 && SIGNATURES.some((s) => s.test(buffer));
}

/** Language-neutral result: the client holds the translated copy for `condition`. */
export function assess() {
  return {
    illustrative: true,
    analyzed: false,
    condition: "early_blight",
  };
}
