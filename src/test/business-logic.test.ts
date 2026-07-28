import { describe, it, expect } from 'vitest';

// ─── Financial calculations ───────────────────────────────────────────────────
describe('Financial calculations', () => {
  const PLATFORM_FEE_PERCENT = 10;
  const DEFAULT_DOCTOR_PERCENT = 50;

  it('calculates doctor earnings correctly', () => {
    const price = 89;
    const doctorEarnings = price * (DEFAULT_DOCTOR_PERCENT / 100);
    const platformFee = price * (PLATFORM_FEE_PERCENT / 100);
    // Repasse 50/50: médico recebe 50% de R$ 89 = R$ 44,50
    expect(doctorEarnings).toBe(44.5);
    expect(platformFee).toBe(8.9);
    expect(doctorEarnings + platformFee).toBeLessThan(price);
  });

  it('formats BRL currency correctly', () => {
    const fmt = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    expect(fmt(89)).toContain('89');
    expect(fmt(1234.56)).toContain('1.234,56');
    expect(fmt(0)).toContain('0');
  });

  it('calculates plan savings vs avulsa', () => {
    const avulsaPrice = 89;
    const monthlyPlan = 149;
    const consultationsPerMonth = 3;
    const savings = (avulsaPrice * consultationsPerMonth) - monthlyPlan;
    expect(savings).toBe(118);
    expect(savings).toBeGreaterThan(0); // plan is cheaper
  });

  it('calculates minimum withdrawal correctly', () => {
    const MIN_WITHDRAWAL = 50;
    const available = 45;
    const canWithdraw = available >= MIN_WITHDRAWAL;
    expect(canWithdraw).toBe(false);
    expect(60 >= MIN_WITHDRAWAL).toBe(true);
  });
});

// ─── Appointment status logic ─────────────────────────────────────────────────
describe('Appointment status logic', () => {
  const STATUSES = ['scheduled', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show'];
  const ACTIVE = ['scheduled', 'waiting', 'in_progress'];
  const FINISHED = ['completed', 'cancelled', 'no_show'];

  it('correctly classifies active vs finished appointments', () => {
    ACTIVE.forEach(s => expect(FINISHED.includes(s)).toBe(false));
    FINISHED.forEach(s => expect(ACTIVE.includes(s)).toBe(false));
    expect(ACTIVE.length + FINISHED.length).toBe(STATUSES.length);
  });

  it('only allows entry to consultation in valid states', () => {
    const canEnter = (status: string) => ['scheduled', 'waiting'].includes(status);
    expect(canEnter('scheduled')).toBe(true);
    expect(canEnter('waiting')).toBe(true);
    expect(canEnter('completed')).toBe(false);
    expect(canEnter('cancelled')).toBe(false);
  });

  it('calculates days until appointment correctly', () => {
    const diffDays = (isoDate: string) => {
      const d = new Date(isoDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      return Math.round((d.getTime() - now.getTime()) / 86400000);
    };
    // Use local date (not UTC) so the comparison stays consistent across timezones
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local TZ
    expect(diffDays(today + 'T10:00:00')).toBe(0);
  });
});

// ─── Shift pricing (plantão 24h) ──────────────────────────────────────────────
describe('Shift pricing', () => {
  const getShiftPrice = (hour: number) => {
    if (hour >= 7 && hour < 19) return { price: 75, shift: 'Diurno' };
    if (hour >= 19 && hour < 24) return { price: 100, shift: 'Noturno' };
    return { price: 120, shift: 'Madrugada' };
  };

  it('returns correct price for each shift', () => {
    expect(getShiftPrice(10).price).toBe(75);   // day
    expect(getShiftPrice(20).price).toBe(100);  // night
    expect(getShiftPrice(3).price).toBe(120);   // dawn
    expect(getShiftPrice(6).price).toBe(120);   // dawn boundary
    expect(getShiftPrice(7).price).toBe(75);    // day boundary
    expect(getShiftPrice(18).price).toBe(75);   // pre-night
    expect(getShiftPrice(19).price).toBe(100);  // night boundary
  });

  it('dawn is most expensive shift', () => {
    const prices = [0, 6, 10, 18, 20, 23].map(h => getShiftPrice(h).price);
    const max = Math.max(...prices);
    expect(max).toBe(120);
  });
});

// ─── CEP validation ───────────────────────────────────────────────────────────
describe('CEP validation', () => {
  const isValidCep = (cep: string) => /^\d{8}$/.test(cep.replace(/\D/g, ''));

  it('validates CEP formats', () => {
    expect(isValidCep('01310-100')).toBe(true);
    expect(isValidCep('01310100')).toBe(true);
    expect(isValidCep('1234')).toBe(false);
    expect(isValidCep('0131010')).toBe(false);
    expect(isValidCep('012345678')).toBe(false);
    expect(isValidCep('abcde-fgh')).toBe(false);
  });
});
