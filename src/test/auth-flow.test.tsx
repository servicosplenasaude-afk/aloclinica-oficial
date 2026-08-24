import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

// Mock supabase client (db é alias de supabase em supabase/untyped.ts).
// Mockar o caminho real garante que vi.mocked(db.auth.signInWithPassword)
// resolva para o vi.fn() injetado abaixo.
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
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
        })),
      })),
    })),
  },
}));

vi.mock("framer-motion", () => {
  // Proxy: motion.<tag> renderiza essa MESMA tag (form precisa virar <form>
  // pra submit funcionar; div pra div; etc).
  const passthrough = (Tag: any) =>
    function Wrapped({ children, ...p }: any) {
      const { initial, animate, exit, whileInView, whileHover, whileTap, transition, viewport, variants, layout, layoutId, ...rest } = p;
      return <Tag {...rest}>{children}</Tag>;
    };
  return {
    motion: new Proxy({}, { get: (_t, tag: string) => passthrough(tag) }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

vi.mock("@/assets/logo.png", () => ({ default: "logo.png" }));
vi.mock("@/assets/mascot-welcome.png", () => ({ default: "mascot.png" }));

import Auth from "@/pages/Auth";
import { db } from "@/integrations/supabase/untyped";

const renderAuth = () =>
  render(
    <BrowserRouter>
      <Auth />
    </BrowserRouter>
  );

describe("Auth Flow", () => {
  beforeEach(() => {
    vi.mocked(db.auth.signInWithPassword).mockReset();
  });

  it("renderiza cards de seleção de perfil por padrão (login fica oculto)", () => {
    renderAuth();
    // Cards de perfil principal
    expect(screen.getByText("Sou paciente")).toBeInTheDocument();
    expect(screen.getByText("Sou médico")).toBeInTheDocument();
    // Login form não está visível inicialmente
    expect(screen.queryByPlaceholderText("voce@exemplo.com")).not.toBeInTheDocument();
    // Mas o botão para revelá-lo existe
    expect(screen.getByText(/fazer login rápido/i)).toBeInTheDocument();
  });

  it("chama signInWithPassword com email/senha ao submeter o login rápido", async () => {
    vi.mocked(db.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "1" } as any, session: null as any },
      error: null,
    });
    renderAuth();

    // Revela o formulário de login rápido
    fireEvent.click(screen.getByText(/fazer login rápido/i));

    // Preenche e envia
    fireEvent.change(screen.getByPlaceholderText("voce@exemplo.com"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(() => {
      expect(db.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "test@test.com",
        password: "password123",
      });
    });
  });

  it("permite voltar dos perfis após abrir o login rápido", () => {
    renderAuth();
    // Abre login
    fireEvent.click(screen.getByText(/fazer login rápido/i));
    expect(screen.getByPlaceholderText("voce@exemplo.com")).toBeInTheDocument();
    // Volta
    fireEvent.click(screen.getByText(/voltar aos perfis/i));
    expect(screen.queryByPlaceholderText("voce@exemplo.com")).not.toBeInTheDocument();
  });
});
