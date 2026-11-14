export function isValidEan13(ean: string): boolean {
  if (!/^\d{13}$/.test(ean)) return false;
  let sum = 0;
  for (let index = 0; index < 12; index += 1) sum += Number(ean[index]) * (index % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(ean[12]);
}
