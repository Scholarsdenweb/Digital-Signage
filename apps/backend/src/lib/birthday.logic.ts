/** Pure birthday helpers, testable without a DB. */

export function isBirthdayToday(dob: Date, today: Date): boolean {
  return dob.getUTCMonth() === today.getUTCMonth() && dob.getUTCDate() === today.getUTCDate();
}

/** Cyclic ordering of birthday instances: A -> B -> C -> A -> B -> C ... */
export function cycleBirthdays<T>(items: T[], loops = 1): T[] {
  const out: T[] = [];
  for (let i = 0; i < loops; i++) out.push(...items);
  return out;
}

export function nextInCycle<T>(items: T[], currentIndex: number): { item: T; index: number } | null {
  if (items.length === 0) return null;
  const index = (currentIndex + 1) % items.length;
  return { item: items[index], index };
}
