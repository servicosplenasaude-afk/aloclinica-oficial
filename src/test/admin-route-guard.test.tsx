import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminRouteGuard } from "@/components/auth/AdminRouteGuard";

const NON_ADMIN_ROLES = [
  "patient",
  "doctor",
  "support",
  "clinic",
  "receptionist",
  "partner",
  "contract_manager",
] as const;

function renderGuard(roles: readonly string[]) {
  return render(
    <MemoryRouter
      initialEntries={["/dashboard/admin/users"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route
          path="/dashboard/admin/users"
          element={
            <AdminRouteGuard roles={roles}>
              <div>Admin privado</div>
            </AdminRouteGuard>
          }
        />
        <Route path="/dashboard" element={<div>Dashboard permitido</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminRouteGuard", () => {
  it.each(NON_ADMIN_ROLES)("nega o painel ao perfil %s", (role) => {
    renderGuard([role]);

    expect(screen.getByText("Dashboard permitido")).toBeInTheDocument();
    expect(screen.queryByText("Admin privado")).not.toBeInTheDocument();
  });

  it("nega usuário autenticado sem papel atribuído", () => {
    renderGuard([]);

    expect(screen.getByText("Dashboard permitido")).toBeInTheDocument();
    expect(screen.queryByText("Admin privado")).not.toBeInTheDocument();
  });

  it("permite somente quando o papel admin está presente", () => {
    renderGuard(["patient", "admin"]);

    expect(screen.getByText("Admin privado")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard permitido")).not.toBeInTheDocument();
  });
});

describe("contrato das rotas administrativas", () => {
  it("mantém todas as rotas admin atrás do guard explícito", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/Dashboard.tsx"), "utf8");
    const adminRoutes = source.match(/<Route path="admin\/[^"]+"[^\n]+/g) ?? [];

    expect(adminRoutes.length).toBeGreaterThanOrEqual(40);
    for (const route of adminRoutes) {
      expect(route).toContain("<AdminRouteGuard roles={roles}>");
    }
  });
});
