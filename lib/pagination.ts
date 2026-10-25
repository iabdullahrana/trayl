export const PAGE_SIZE = 20;
export function pageNumber(value: unknown) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 && n <= 100000 ? n : 1;
}
