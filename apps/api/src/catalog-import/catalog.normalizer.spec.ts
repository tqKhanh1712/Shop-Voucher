import { createDemoCampaignSchedule } from './catalog.normalizer';

describe('Giftpop catalog demo schedule', () => {
  it('keeps seeded dates deterministic and inside the requested September range', () => {
    const first = createDemoCampaignSchedule('MP2106220019');
    const second = createDemoCampaignSchedule('MP2106220019');
    const earliest = new Date('2026-09-20T00:00:00+07:00');
    const latest = new Date('2026-09-30T00:00:00+07:00');

    expect(second).toEqual(first);
    expect(first.saleStart.getTime()).toBeGreaterThanOrEqual(
      earliest.getTime(),
    );
    expect(first.saleStart.getTime()).toBeLessThanOrEqual(latest.getTime());
    expect(first.saleEnd.getTime()).toBeGreaterThan(first.saleStart.getTime());
    expect([7, 30, 45]).toContain(first.usageValidityDays);
  });

  it('distributes the configured validity milestones across a representative dataset', () => {
    const validityDays = new Set(
      Array.from(
        { length: 100 },
        (_, index) =>
          createDemoCampaignSchedule(`GIFTPOP-${index}`).usageValidityDays,
      ),
    );

    expect(validityDays).toEqual(new Set([7, 30, 45]));
  });
});
