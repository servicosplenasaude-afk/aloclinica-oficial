import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/assets/mascot.png", () => ({ default: "mascot.png" }));
vi.mock("@/assets/mascot-wave.png", () => ({ default: "wave.png" }));

const TestRouter = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

// ─── PasswordStrength ───
describe("PasswordStrength", () => {
  it("shows Fraca for short passwords", async () => {
    const { default: PasswordStrength } = await import("@/components/ui/password-strength");
    render(<PasswordStrength password="ab" />);
    expect(screen.getByText("Fraca")).toBeInTheDocument();
  });

  it("shows Forte for complex passwords", async () => {
    const { default: PasswordStrength } = await import("@/components/ui/password-strength");
    render(<PasswordStrength password="Abc123!@#xyz" />);
    expect(screen.getByText("Forte")).toBeInTheDocument();
  });
});

// ─── ErrorBoundary ───
describe("ErrorBoundary", () => {
  const ThrowError = () => { throw new Error("Test boom"); };

  it("catches errors and shows fallback UI", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { default: ErrorBoundary } = await import("@/components/ErrorBoundary");
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText("Oops! Algo deu errado")).toBeInTheDocument();
    expect(screen.getByText("Recarregar")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
