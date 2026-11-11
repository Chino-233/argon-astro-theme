export function colorPalette(value: string) {
  const hex = /^#[\da-f]{6}$/i.test(value) ? value : '#5e72e4';
  const [red, green, blue] = hex.slice(1).match(/.{2}/g)!.map((part) => parseInt(part, 16));
  const [r, g, b] = [red / 255, green / 255, blue / 255];
  const hi = Math.max(r, g, b);
  const lo = Math.min(r, g, b);
  const light = (hi + lo) / 2;
  const delta = hi - lo;
  const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  const hue = delta === 0 ? 0
    : hi === r ? ((g - b) / delta + 6) % 6
    : hi === g ? (b - r) / delta + 2
    : (r - g) / delta + 4;
  return {
    '--themecolor': hex,
    '--themecolor-R': String(red), '--themecolor-G': String(green), '--themecolor-B': String(blue),
    '--themecolor-H': String(Math.round(hue * 60)),
    '--themecolor-S': String(Math.round(sat * 100)),
    '--themecolor-L': String(Math.round(light * 100)),
  };
}
