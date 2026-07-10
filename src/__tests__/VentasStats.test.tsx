// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VentasStats from "@/components/VentasStats";

const mockStats = {
  todaySalesCount: 5,
  todayTotalUSD: 250.5,
  todayTotalBs: 0,
  monthlyTotalUSD: 3500.75,
  monthlyTotalBs: 0,
};

const mockStatsWithBs = {
  todaySalesCount: 3,
  todayTotalUSD: 120.0,
  todayTotalBs: 350.0,
  monthlyTotalUSD: 1800.0,
  monthlyTotalBs: 5200.0,
};

describe("VentasStats", () => {
  it("renders the three stat cards", () => {
    const { container } = render(<VentasStats stats={mockStats} />);
    expect(screen.getByText("Ventas Hoy")).toBeInTheDocument();
    expect(screen.getByText("Total Hoy")).toBeInTheDocument();
    expect(screen.getByText("Total General")).toBeInTheDocument();
  });

  it("displays today sales count correctly", () => {
    render(<VentasStats stats={mockStats} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("displays monthly total USD correctly", () => {
    render(<VentasStats stats={mockStats} />);
    expect(screen.getByText("$3500.75 USD")).toBeInTheDocument();
  });

  it("shows Bs amounts when present", () => {
    render(<VentasStats stats={mockStatsWithBs} />);
    expect(screen.getByText("Bs 350.00")).toBeInTheDocument();
    expect(screen.getByText("Bs 5200.00")).toBeInTheDocument();
  });

  it("does not show Bs amounts when they are zero", () => {
    render(<VentasStats stats={mockStats} />);
    expect(screen.queryByText(/^Bs/)).not.toBeInTheDocument();
  });

  it("renders 3 card-hover containers", () => {
    const { container } = render(<VentasStats stats={mockStats} />);
    const cards = container.querySelectorAll(".card-hover");
    expect(cards.length).toBe(3);
  });
});
