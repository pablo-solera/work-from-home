export function requestRange(dates: string[]) {
  const sorted = dates.toSorted();
  return { start: sorted[0], end: sorted[sorted.length - 1] };
}
