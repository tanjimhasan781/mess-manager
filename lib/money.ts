/** 12345 paisa -> "123.45" with thousands separators. */
export function tk(paisa: number): string {
  const sign = paisa < 0 ? '-' : '';
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100).toLocaleString('en-IN');
  const frac = abs % 100;
  return `${sign}${whole}${frac ? '.' + String(frac).padStart(2, '0') : ''}`;
}

/** "450", "450.5", "1,200.75" -> paisa. Returns null for anything else. */
export function parseTk(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const neg = s.startsWith('-');
  const [w, f = ''] = s.replace('-', '').split('.');
  const v = Number(w) * 100 + Number(f.padEnd(2, '0'));
  return neg ? -v : v;
}
