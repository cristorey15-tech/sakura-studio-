// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardTopServicesChart from "@/components/DashboardTopServicesChart";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar">{children}</div>
  ),
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Cell: () => <div data-testid="cell" />,
}));

const mockTopServices = [
  { id: 1, name: "Maquillaje Social", category: "MAQUILLAJE", count: 25 },
  { id: 2, name: "Lifting de Pestañas", category: "PESTAÑAS", count: 18 },
  { id: 3, name: "Diseño de Cejas", category: "CEJAS", count: 15 },
];

describe("DashboardTopServicesChart", () => {
  it("renders title and badge", () => {
    render(<DashboardTopServicesChart topServices={mockTopServices} />);
    expect(screen.getByText("Servicios Más Populares")).toBeInTheDocument();
    expect(screen.getByText("Por reservas")).toBeInTheDocument();
  });

  it("renders BarChart when data exists", () => {
    const { container } = render(<DashboardTopServicesChart topServices={mockTopServices} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    render(<DashboardTopServicesChart topServices={[]} />);
    expect(screen.getByText("Sin reservas aún")).toBeInTheDocument();
    expect(screen.queryByTestId("responsive-container")).not.toBeInTheDocument();
  });

  it("renders correct number of Cell elements for each service", () => {
    const { container } = render(<DashboardTopServicesChart topServices={mockTopServices} />);
    const cells = container.querySelectorAll("[data-testid='cell']");
    expect(cells.length).toBe(3);
  });

  it("renders with a single service", () => {
    const singleService = [{ id: 5, name: "Manicure", category: "MANICURE", count: 3 }];
    render(<DashboardTopServicesChart topServices={singleService} />);
    expect(screen.queryByTestId("responsive-container")).toBeInTheDocument();
  });
});
