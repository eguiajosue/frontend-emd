"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getStatusChartColor } from "@/lib/statusColors";

interface OrdersByStatusPieChartProps {
  data: Array<{ status: string; statusId: number; total: number }>;
}

export default function OrdersByStatusPieChart({ data }: OrdersByStatusPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="status"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={(entry: { name?: string | number }) => String(entry.name ?? "").toUpperCase()}
        >
          {data.map((entry) => (
            <Cell key={`cell-${entry.statusId}`} fill={getStatusChartColor(entry.statusId)} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [value, "Pedidos"] as [number, string]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
