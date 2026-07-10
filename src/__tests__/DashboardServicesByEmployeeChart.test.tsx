// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardServicesByEmployeeChart from "@/components/DashboardServicesByEmployeeChart";

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

const mockServicesByEmployee = [
  { employeeId: 1, employeeName: "Ana García", count: 15 },
  { employeeId: 2, employeeName: "María López", count: 12 },
  { employeeId: 3, employeeName: "Carolina Pérez", count: 8 },
];

describe("DashboardServicesByEmployeeChart", () => {
  it("renders title and badge", () => {
    render(<DashboardServicesByEmployeeChart servicesByEmployee={mockServicesByEmployee} />);
    expect(screen.getByText("Servicios por Empleada")).toBeInTheDocument();
    expect(screen.getByText("Esta semana")).toBeInTheDocument();
  });

  it("renders BarChart when data exists", () => {
    render(<DashboardServicesByEmployeeChart servicesByEmployee={mockServicesByEmployee} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    render(<DashboardServicesByEmployeeChart servicesByEmployee={[]} />);
    expect(screen.getByText("Sin servicios esta semana")).toBeInTheDocument();
    expect(screen.queryByTestId("responsive-container")).not.toBeInTheDocument();
  });

  it("shows empty state when all counts are zero", () => {
    const allZero = [
      { employeeId: 1, employeeName: "Ana", count: 0 },
      { employeeId: 2, employeeName: "María", count: 0 },
    ];
    render(<DashboardServicesByEmployeeChart servicesByEmployee={allZero} />);
    expect(screen.getByText("Sin servicios esta semana")).toBeInTheDocument();
  });

  it("renders with a single employee", () => {
    const single = [{ employeeId: 5, employeeName: "Sofía", count: 20 }];
    render(<DashboardServicesByEmployeeChart servicesByEmployee={single} />);
    expect(screen.queryByTestId("responsive-container")).toBeInTheDocument();
  });

  it("renders correct number of Cell elements", () => {
    const { container } = render(<DashboardServicesByEmployeeChart servicesByEmployee={mockServicesByEmployee} />);
    const cells = container.querySelectorAll("[data-testid='cell']");
    expect(cells.length).toBe(3);
  });
});
