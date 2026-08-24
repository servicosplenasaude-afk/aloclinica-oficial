import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Mock supabase — getSession resolve com session=null e onAuthStateChange
// nunca dispara; AuthProvider deve transitar de loading=true para false.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
        })),
      })),
    })),
  },
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: () => ({ children, ...p }: any) => {
      const { initial, animate, exit, transition, viewport, whileInView, ...rest } = p;
      return <div {...rest}>{children}</div>;
    },
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/assets/logo.png", () => ({ default: "logo.png" }));

import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

describe("ProtectedRoute", () => {
  it("redireciona usuário não autenticado para a página de login do paciente (default)", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <Routes>
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <div>Dashboard Content</div>
              </ProtectedRoute>
            } />
            {/* Sem requiredRole, ProtectedRoute redireciona para /paciente */}
            <Route path="/paciente" element={<div>Página de login do paciente</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Página de login do paciente")).toBeInTheDocument();
    }, { timeout: 5000 });
    // E o conteúdo protegido NÃO deve estar acessível
    expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();
  });

  it("redireciona para /admin quando requiredRole é admin e usuário não está autenticado", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/painel"]}>
        <AuthProvider>
          <Routes>
            <Route path="/admin/painel" element={
              <ProtectedRoute requiredRole="admin">
                <div>Admin Content</div>
              </ProtectedRoute>
            } />
            <Route path="/admin" element={<div>Login do Admin</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Login do Admin")).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
