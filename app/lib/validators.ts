export function isSriLankanNIC(nic: string) {
  // very loose check: old 9 digits + letter OR 12 digits
  const s = nic.trim().toUpperCase();
  return /^[0-9]{9}[V|X]$/.test(s) || /^[0-9]{12}$/.test(s);
}

export function isPhoneOk(p: string) {
  // basic: digits, +, spaces, hyphens; at least 7 digits
  const d = (p.match(/\d/g) || []).length;
  return d >= 7;
}

export function isNonEmpty(x?: string | null) {
  return !!x && x.trim().length > 1;
}
