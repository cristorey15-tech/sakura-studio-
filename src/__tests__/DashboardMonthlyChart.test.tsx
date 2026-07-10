// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardMonthlyChart from "@/components/DashboardMonthlyChart";

// Mock recharts ResponsiveContainer to render children directly
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: ({ dataKey, stroke }: { dataKey: string; stroke: string }) => (
    <div data-testid="line" data-datakey={dataKey} data-stroke={stroke} />
  ),
  XAxis: (props: any) => <div data-testid="xaxis" data-datakey={props.dataKey} />,
  YAxis: () => <div data-testid="yaxis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

const mockTrend = [
  { month: "2026-01", label: "Ene", total: 1000, count: 10 },
  { month: "2026-02", label: "Feb", total: 1500, count: 12 },
  { month: "2026-03", label: "Mar", total: 2000, count: 15 },
  { month: "2026-04", label: "Abr", total: 1800, count: 14 },
  { month: "2026-05", label: "May", total: 2500, count: 18 },
  { month: "2026-06", label: "Jun", total: 3000, count: 20 },
];

const mockEmptyTrend: typeof mockTrend = [];

const formatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

describe("DashboardMonthlyChart", () => {
  it("renders title and toggle buttons", () => {
    render(
      <DashboardMonthlyChart
        monthlyTrend={mockTrend}
        showMonths={12}
        onToggleMonths={vi.fn()}
        formatter={formatter}
      />
    );
    expect(screen.getByText("Ingresos Mensuales")).toBeInTheDocument();
    expect(screen.getByText("6 meses")).toBeInTheDocument();
    expect(screen.getByText("12 meses")).toBeInTheDocument();
  });

  it("shows 12 meses as active by default", () => {
    render(
      <DashboardMonthlyChart
        monthlyTrend={mockTrend}
        showMonths={12}
        onToggleMonths={vi.fn()}
        formatter={formatter}
      />
    );
    const btn12 = screen.getByText("12 meses");
    expect(btn12.className).toContain("bg-white");
    expect(btn12.className).toContain("shadow-sm");
  });

  it("shows 6 meses as active when showMonths=6", () => {
    render(
      <DashboardMonthlyChart
        monthlyTrend={mockTrend}
        showMonths={6}
        onToggleMonths={vi.fn()}
        formatter={formatter}
      />
    );
    const btn6 = screen.getByText("6 meses");
    expect(btn6.className).toContain("bg-white");
    expect(btn6.className).toContain("shadow-sm");
  });

  it("calls onToggleMonths when clicking toggle button", () => {
    const onToggle = vi.fn();
    render(
      <DashboardMonthlyChart
        monthlyTrend={mockTrend}
        showMonths={12}
        onToggleMonths={onToggle}
        formatter={formatter}
      />
    );
    fireEvent.click(screen.getByText("6 meses"));
    expect(onToggle).toHaveBeenCalledWith(6);
  });

  it("renders LineChart when data exists", () => {
    const { container } = render(
      <DashboardMonthlyChart
        monthlyTrend={mockTrend}
        showMonths={12}
        onToggleMonths={vi.fn()}
        formatter={formatter}
      />
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    render(
      <DashboardMonthlyChart
        monthlyTrend={mockEmptyTrend}
        showMonths={12}
        onToggleMonths={vi.fn()}
        formatter={formatter}
      />
    );
    expect(screen.getByText("Sin datos de ingresos")).toBeInTheDocument();
    expect(screen.queryByTestId("responsive-container")).not.toBeInTheDocument();
  });

  it("shows empty state when all totals are zero", () => {
    const allZeroTrend = [
      { month: "2026-01", label: "Ene", total: 0, count: 0 },
    ];
    render(
      <DashboardMonthlyChart
        monthlyTrend={allZeroTrend}
        showMonths={12}
        onToggleMonths={vi.fn()}
        formatter={formatter}
      />
    );
    expect(screen.getByText("Sin datos de ingresos")).toBeInTheDocument();
  });
});
