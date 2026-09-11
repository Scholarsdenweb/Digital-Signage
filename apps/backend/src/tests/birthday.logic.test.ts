import { describe, it, expect } from 'vitest';
import { isBirthdayToday, cycleBirthdays, nextInCycle } from '../lib/birthday.logic.js';

describe('birthday logic', () => {
  // Scenario 19: birthday generation matches month/day regardless of year
  it('matches birthday by month and day, ignoring year', () => {
    const today = new Date(Date.UTC(2026, 8, 6)); // 2026-09-06
    expect(isBirthdayToday(new Date(Date.UTC(2008, 8, 6)), today)).toBe(true);
    expect(isBirthdayToday(new Date(Date.UTC(2007, 8, 6)), today)).toBe(true);
    expect(isBirthdayToday(new Date(Date.UTC(2008, 0, 15)), today)).toBe(false);
  });

  // Scenario 20: birthday cycling Rahul -> Aman -> Priya -> Rahul ...
  it('cycles birthdays in order and wraps around', () => {
    const kids = ['Rahul', 'Aman', 'Priya'];
    expect(cycleBirthdays(kids, 2)).toEqual(['Rahul', 'Aman', 'Priya', 'Rahul', 'Aman', 'Priya']);
    expect(nextInCycle(kids, 2)?.item).toBe('Rahul'); // wraps from last back to first
    expect(nextInCycle(kids, 0)?.item).toBe('Aman');
  });
});
