import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    motion: new Proxy({}, {
      get: () => ({ children, ...p }: any) => {
        const { initial, animate, exit, whileInView, whileHover, whileTap, transition, viewport, variants, ...rest } = p;
        return <div {...rest}>{children}</div>;
      },
    }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

vi.mock("@/assets/hero-doctor.png", () => ({ default: "hero.png" }));
vi.mock("@/assets/mascot-wave.png", () => ({ default: "wave.png" }));
vi.mock("@/assets/mascot-thumbsup.png", () => ({ default: "thumbs.png" }));
vi.mock("@/assets/mascot-reading.png", () => ({ default: "reading.png" }));
vi.mock("@/assets/mascot-welcome.png", () => ({ default: "welcome.png" }));
vi.mock("@/assets/logo.png", () => ({ default: "logo.png" }));

import { I18nProvider } from "@/i18n";
import Header from "@/components/landing/Header";
import StatsSection from "@/components/landing/StatsSection";

describe("Header", () => {
  beforeEach(() => {
    localStorage.setItem("locale", "pt-BR");
  });

  it("renderiza logo e principais itens de menu", () => {
    render(
      <BrowserRouter>
        <I18nProvider>
          <Header />
        </I18nProvider>
      </BrowserRouter>
    );
    // Logo presente (alt da marca; regex tolerante a variações/acentos)
    expect(screen.getByAltText(/al[ôo]\s*cl[íi]nica|logo/i)).toBeInTheDocument();
    // O Header tem itens de menu diretos (Saúde Corporativa vem do menu base).
    expect(screen.getAllByText("Saúde Corporativa").length).toBeGreaterThan(0);
  });
});

describe("StatsSection", () => {
  it("renders stat labels", () => {
    render(<BrowserRouter><StatsSection /></BrowserRouter>);
    // Rótulos honestos (conteúdo CFM) definidos em StatsSection.fallbackStats
    expect(screen.getByText("Atendimento")).toBeInTheDocument();
    expect(screen.getByText("Médicos verificados")).toBeInTheDocument();
  });
});
