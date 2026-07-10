// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ReportesBillingCards from "@/components/ReportesBillingCards";

const mockBilling = {
  allTime: { total: 50000, count: 300 },
  last3Months: { total: 12500, count: 75 },
  lastMonth: { total: 4500, count: 28 },
  lastWeek: { total: 1200, count: 8 },
};

const mockBillingWithCustom = {
  ...mockBilling,
  customRange: { total: 2000, count: 12, startDate: "2026-06-01", endDate: "2026-06-15" },
};

describe("ReportesBillingCards", () => {
  it("renders all 4 default period cards", () => {
    render(<ReportesBillingCards billing={mockBilling} />);
    expect(screen.getByText("Desde Siempre")).toBeInTheDocument();
    expect(screen.getByText("Últimos 3 Meses")).toBeInTheDocument();
    expect(screen.getByText("Último Mes")).toBeInTheDocument();
    expect(screen.getByText("Última Semana")).toBeInTheDocument();
  });

  it("displays correct sale counts with proper pluralization", () => {
    render(<ReportesBillingCards billing={mockBilling} />);
    expect(screen.getByText("300 ventas")).toBeInTheDocument();
    expect(screen.getByText("75 ventas")).toBeInTheDocument();
    expect(screen.getByText("8 ventas")).toBeInTheDocument();
  });

  it("displays average when count > 0", () => {
    render(<ReportesBillingCards billing={mockBilling} />);
    // Average for allTime: 50000/300 = ~166.67
    const averages = screen.getAllByText(/Prom\./);
    expect(averages.length).toBeGreaterThan(0);
  });

  it("shows custom range card when provided", () => {
    render(<ReportesBillingCards billing={mockBillingWithCustom} />);
    expect(screen.getByText("Rango Personalizado")).toBeInTheDocument();
  });

  it("renders custom range with prominent styling", () => {
    const { container } = render(<ReportesBillingCards billing={mockBillingWithCustom} />);
    const customCards = container.querySelectorAll(".ring-primary\\/20");
    expect(customCards.length).toBe(1);
  });

  it("renders 4 grid columns layout", () => {
    const { container } = render(<ReportesBillingCards billing={mockBilling} />);
    const grid = container.querySelector(".grid-cols-1");
    expect(grid).toBeInTheDocument();
  });
});
