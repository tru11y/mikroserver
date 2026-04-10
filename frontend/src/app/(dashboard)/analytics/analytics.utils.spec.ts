import {
  createEmptySubscriptionDailyList,
  createEmptyTicketReport,
  formatRevenuePoints,
  getActivationRate,
} from './analytics.utils';

describe('analytics.utils', () => {
  it('creates an empty subscription list for a given date', () => {
    expect(createEmptySubscriptionDailyList('2026-03-25')).toEqual({
      date: '2026-03-25',
      count: 0,
      uniqueCustomers: 0,
      totalRevenueXof: 0,
      items: [],
    });
  });

  it('creates an empty ticket report structure', () => {
    expect(createEmptyTicketReport().summary).toEqual({
      created: 0,
      activated: 0,
      completed: 0,
      deleted: 0,
      deliveryFailed: 0,
      totalActivatedAmountXof: 0,
      routersTouched: 0,
      operatorsTouched: 0,
      plansTouched: 0,
    });
  });

  it('formats revenue points for charts', () => {
    expect(
      formatRevenuePoints([
        { date: '2026-03-25T00:00:00.000Z', revenueXof: 1200, transactions: 3 },
      ]),
    ).toEqual([
      {
        date: expect.any(String),
        revenus: 1200,
        transactions: 3,
      },
    ]);
  });

  it('computes activation rate safely', () => {
    expect(
      getActivationRate({
        id: 'router-1',
        name: 'Router 1',
        created: 10,
        activated: 4,
        completed: 2,
        deliveryFailed: 1,
        activatedAmountXof: 5000,
      }),
    ).toBe('40%');
    expect(
      getActivationRate({
        id: 'router-2',
        name: 'Router 2',
        created: 0,
        activated: 0,
        completed: 0,
        deliveryFailed: 0,
        activatedAmountXof: 0,
      }),
    ).toBe('0%');
  });
});
