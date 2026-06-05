import { http, HttpResponse } from 'msw';

/** Mock API handlers for frontend testing */
export const handlers = [
  // ── Energy Dashboard ────────────────────────────────────────────
  http.get('/api/energy/dashboard', () =>
    HttpResponse.json({
      byType: { ELECTRICITY: 12500, WATER: 3200, GAS: 1800 },
      trend: { '2026-01': 4500, '2026-02': 4200, '2026-03': 4800 },
      assetRanking: [
        { assetId: 1, consumption: 2500 },
        { assetId: 2, consumption: 1800 },
      ],
      total: 17500,
      periodType: 'MONTH',
    })
  ),

  http.get('/api/energy/dashboard', ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.has('locationId')) {
      return HttpResponse.json({
        byType: { ELECTRICITY: 6500 },
        trend: { '2026-01': 2100, '2026-02': 2000, '2026-03': 2400 },
        assetRanking: [{ assetId: 1, consumption: 1200 }],
        total: 6500,
        periodType: 'MONTH',
      });
    }
    return undefined;
  }),

  // ── Energy Compare ──────────────────────────────────────────────
  http.get('/api/energy/compare', () =>
    HttpResponse.json({
      current: { '2026-03': 4800 },
      previous: { '2025-03': 4300 },
      changeRate: 11.63,
      currentTotal: 4800,
      previousTotal: 4300,
    })
  ),

  // ── Energy Ranking ──────────────────────────────────────────────
  http.get('/api/energy/ranking', () =>
    HttpResponse.json([
      { assetId: 1, assetName: '空调主机A', consumption: 2500 },
    ])
  ),

  // ── Energy Anomalies ────────────────────────────────────────────
  http.get('/api/energy/anomalies', () =>
    HttpResponse.json([
      { period: '2026-03', value: 4800, expected: 3500, deviation: 2.1, severity: 'medium' },
    ])
  ),

  // ── Energy Meters ───────────────────────────────────────────────
  http.get('/api/energy/meters', () =>
    HttpResponse.json([
      { id: 1, assetId: 1, meterType: 'ELECTRICITY', readingValue: 1000, unit: 'kWh' },
    ])
  ),

  http.post('/api/energy/meters', () =>
    HttpResponse.json({ id: 1, assetId: 1, meterType: 'ELECTRICITY', readingValue: 1000, unit: 'kWh' })
  ),

  // ── Energy Summary ──────────────────────────────────────────────
  http.get('/api/energy/summary/by-location', () =>
    HttpResponse.json({
      byType: { ELECTRICITY: 6500 },
      trend: { '2026-01': 2100 },
      assetRanking: [],
      total: 6500,
    })
  ),

  http.get('/api/energy/consumption/aggregate', () =>
    HttpResponse.json([
      { id: 1, assetId: 1, periodType: 'MONTH', consumption: 5000 },
    ])
  ),

  http.get('/api/energy/consumption', () =>
    HttpResponse.json([
      { id: 1, assetId: 1, meterType: 'ELECTRICITY', periodType: 'MONTH', consumption: 5000 },
    ])
  ),

  // ── Energy By Space ─────────────────────────────────────────────
  http.get('/api/energy/by-space', () =>
    HttpResponse.json([
      { locationId: 1, locationName: 'A栋', total: 12500 },
    ])
  ),

  // ── Energy Location Assets ──────────────────────────────────────
  http.get('/api/energy/locations/:id/assets', () =>
    HttpResponse.json([
      { assetId: 1, assetName: '空调主机A', consumption: 2500 },
    ])
  ),

  // ── Floor Plans ─────────────────────────────────────────────────
  http.get('/api/floor-plans', () =>
    HttpResponse.json({
      code: 200,
      data: {
        records: [{ id: 1, name: 'A栋平面图', floor: '1F', totalArea: 5000 }],
        total: 1,
      },
    })
  ),

  http.get('/api/floor-plans/:id', () =>
    HttpResponse.json({
      code: 200,
      data: { id: 1, name: 'A栋平面图', floor: '1F', totalArea: 5000 },
    })
  ),

  http.get('/api/floor-plans/:id/assets', () =>
    HttpResponse.json({
      code: 200,
      data: [
        { id: 1, planId: 1, assetId: 1, posX: 100, posY: 200, label: '空调A' },
      ],
    })
  ),

  // ── GIS Assets ──────────────────────────────────────────────────
  http.get('/api/gis/assets', () =>
    HttpResponse.json([
      { id: 1, assetNo: 'A-001', assetName: '空调主机A', status: 'IN_USE', latitude: 39.9042, longitude: 116.4074 },
    ])
  ),
];
