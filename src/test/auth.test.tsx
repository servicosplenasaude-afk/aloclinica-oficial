import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null })) })) })),
    })),
  },
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const TestConsumer = () => {
  const { user, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? "logged-in" : "guest"}</span>
    </div>
  );
};

describe("AuthContext", () => {
  it("provides default guest state", async () => {
    await act(async () => {
      render(
        <BrowserRouter>
          <AuthProvider>
            <TestConsumer />
          </AuthProvider>
        </BrowserRouter>
      );
    });
    // Initially loading, then resolves to guest
    expect(screen.getByTestId("user")).toHaveTextContent("guest");
  });
});
