import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UrgentCareQueue from "@/components/patient/UrgentCareQueue";

// Mock supabase
const { mockInvoke, mockFrom, mockChannel, mockRemoveChannel } = vi.hoisted(() => ({
  mockInvoke: vi.fn().mockResolvedValue({ data: { shift: "day", price: 75, label: "Diurno" } }),
  mockFrom: vi.fn(),
  mockChannel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
  mockRemoveChannel: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
    from: (...args: any[]) => mockFrom(...args),
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user-id" }, roles: ["patient"], loading: false }),
}));

vi.mock("@/components/dashboards/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock("@/components/patient/patientNav", () => ({
  getPatientNav: () => [],
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("framer-motion", () => ({
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

describe("UrgentCareQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Chain thenable: suporta .eq().eq().order().order().maybeSingle()/single()
    // (o cliente supabase real encadeia vários .eq()/.order() — ex.: useSavedCards.list)
    const makeChain = (data: any): any => {
      const resolved = Promise.resolve({ data, error: null });
      return Object.assign(resolved, {
        eq: () => makeChain(data),
        in: () => makeChain(data),
        order: () => makeChain(data),
        limit: () => makeChain(data),
        range: () => makeChain(data),
        single: () => Promise.resolve({ data: Array.isArray(data) ? (data[0] ?? null) : data, error: null }),
        maybeSingle: () => Promise.resolve({ data: Array.isArray(data) ? (data[0] ?? null) : data, error: null }),
      });
    };

    // Default: no active entry, no discount
    mockFrom.mockImplementation((table: string) => {
      if (table === "discount_cards") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
        };
      }
      if (table === "on_demand_queue") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ data: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }
      // Fallback chainable (ex.: saved_cards faz .eq().eq().order().order())
      return { select: () => makeChain([]), insert: () => Promise.resolve({ error: null }) };
    });
  });

  it("renders shift price info from edge function", async () => {
    render(<UrgentCareQueue />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("calculate-shift-price");
    });

    await waitFor(() => {
      expect(screen.getByText("Diurno")).toBeInTheDocument();
    });
  });

  it("shows correct shift pricing tiers", async () => {
    render(<UrgentCareQueue />);

    await waitFor(() => {
      expect(screen.getByText("Diurno 07–19h")).toBeInTheDocument();
      expect(screen.getByText("R$ 75")).toBeInTheDocument();
      expect(screen.getByText("Noturno 19–00h")).toBeInTheDocument();
      expect(screen.getByText("R$ 100")).toBeInTheDocument();
      expect(screen.getByText("Madrugada 00–07h")).toBeInTheDocument();
      expect(screen.getByText("R$ 120")).toBeInTheDocument();
    });
  });

  it("checks discount card on mount", async () => {
    render(<UrgentCareQueue />);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("discount_cards");
    });
  });
});

describe("Shift Price Calculation Logic", () => {
  it("returns correct shift for different hours", () => {
    const getShift = (hour: number) => {
      if (hour >= 7 && hour < 19) return { shift: "day", price: 75, label: "Diurno" };
      if (hour >= 19 && hour < 24) return { shift: "night", price: 100, label: "Noturno" };
      return { shift: "dawn", price: 120, label: "Madrugada" };
    };

    expect(getShift(8)).toEqual({ shift: "day", price: 75, label: "Diurno" });
    expect(getShift(20)).toEqual({ shift: "night", price: 100, label: "Noturno" });
    expect(getShift(3)).toEqual({ shift: "dawn", price: 120, label: "Madrugada" });
    expect(getShift(7)).toEqual({ shift: "day", price: 75, label: "Diurno" });
    expect(getShift(19)).toEqual({ shift: "night", price: 100, label: "Noturno" });
    expect(getShift(0)).toEqual({ shift: "dawn", price: 120, label: "Madrugada" });
  });

  it("applies discount correctly", () => {
    const applyDiscount = (price: number, discountPercent: number) =>
      discountPercent > 0 ? price * (1 - discountPercent / 100) : price;

    expect(applyDiscount(75, 30)).toBe(52.5);
    expect(applyDiscount(100, 30)).toBe(70);
    expect(applyDiscount(120, 30)).toBe(84);
    expect(applyDiscount(75, 0)).toBe(75);
  });

  it("formats wait time correctly", () => {
    const formatTime = (s: number) =>
      `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(900)).toBe("15:00");
    expect(formatTime(3661)).toBe("61:01");
  });
});
