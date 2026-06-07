import { calculateMonthlyIntensity } from './monthly-heatmap-intensity';

describe('calculateMonthlyIntensity', () => {
  it('maps weight to intensity 0–4', () => {
    expect(calculateMonthlyIntensity({ addedCount: 0, completedCount: 0 })).toBe(0);
    expect(calculateMonthlyIntensity({ addedCount: 1, completedCount: 0 })).toBe(1);
    expect(calculateMonthlyIntensity({ addedCount: 0, completedCount: 1 })).toBe(1);
    expect(calculateMonthlyIntensity({ addedCount: 1, completedCount: 1 })).toBe(2);
    expect(calculateMonthlyIntensity({ addedCount: 2, completedCount: 2 })).toBe(2);
    expect(calculateMonthlyIntensity({ addedCount: 4, completedCount: 0 })).toBe(2);
    expect(calculateMonthlyIntensity({ addedCount: 3, completedCount: 2 })).toBe(3);
    expect(calculateMonthlyIntensity({ addedCount: 5, completedCount: 3 })).toBe(3);
    expect(calculateMonthlyIntensity({ addedCount: 8, completedCount: 0 })).toBe(3);
    expect(calculateMonthlyIntensity({ addedCount: 5, completedCount: 4 })).toBe(4);
    expect(calculateMonthlyIntensity({ addedCount: 99, completedCount: 0 })).toBe(4);
  });

  it('ignores non-finite or negative parts via truncation', () => {
    expect(calculateMonthlyIntensity({ addedCount: Number.NaN, completedCount: 2 })).toBe(2);
    expect(calculateMonthlyIntensity({ addedCount: -3, completedCount: 2 })).toBe(2);
  });
});
