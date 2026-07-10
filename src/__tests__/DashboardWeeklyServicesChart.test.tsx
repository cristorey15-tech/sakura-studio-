// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardWeeklyServicesChart from "@/components/DashboardWeeklyServicesChart";

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

const mockWeeklyServices = [
  { serviceId: 10, serviceName: "Maquillaje Social", category: "MAQUILLAJE", count: 12 },
  { serviceId: 20, serviceName: "Lifting", category: "PESTAÑAS", count: 8 },
  { serviceId: 30, serviceName: "Diseño de Cejas", category: "CEJAS", count: 5 },
];

describe("DashboardWeeklyServicesChart", () => {
  it("renders title and badge", () => {
    render(<DashboardWeeklyServicesChart weeklyServices={mockWeeklyServices} />);
    expect(screen.getByText("Servicios de la Semana")).toBeInTheDocument();
    expect(screen.getByText("Esta semana")).toBeInTheDocument();
  });

  it("renders BarChart when data exists", () => {
    render(<DashboardWeeklyServicesChart weeklyServices={mockWeeklyServices} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    render(<DashboardWeeklyServicesChart weeklyServices={[]} />);
    expect(screen.getByText("Sin servicios esta semana")).toBeInTheDocument();
    expect(screen.queryByTestId("responsive-container")).not.toBeInTheDocument();
  });

  it("shows empty state when data is null/undefined", () => {
    render(<DashboardWeeklyServicesChart weeklyServices={undefined as any} />);
    expect(screen.getByText("Sin servicios esta semana")).toBeInTheDocument();
  });

  it("renders badges with service counts", () => {
    render(<DashboardWeeklyServicesChart weeklyServices={mockWeeklyServices} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders service names in badges", () => {
    render(<DashboardWeeklyServicesChart weeklyServices={mockWeeklyServices} />);
    expect(screen.getByText("Maquillaje Social")).toBeInTheDocument();
    expect(screen.getByText("Lifting")).toBeInTheDocument();
    expect(screen.getByText("Diseño de Cejas")).toBeInTheDocument();
  });

  it("renders correct number of Cell elements", () => {
    const { container } = render(<DashboardWeeklyServicesChart weeklyServices={mockWeeklyServices} />);
    const cells = container.querySelectorAll("[data-testid='cell']");
    expect(cells.length).toBe(3);
  });
});
