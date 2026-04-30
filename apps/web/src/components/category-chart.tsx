'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatILS } from '@famileconomy/utils'
import type { CategoryBreakdownSlice } from '@famileconomy/utils'

// ─── Helpers ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

function sliceColor(index: number): string {
  const fallback = 'hsl(var(--chart-1))'
  return CHART_COLORS[index % CHART_COLORS.length] ?? fallback
}

// ─── Custom tooltip ──────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string
  value: number
  payload: CategoryBreakdownSlice
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  if (!entry) return null
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{entry.name}</p>
      <p className="text-muted-foreground">{formatILS(entry.value)}</p>
      <p className="text-muted-foreground">{entry.payload.percent.toFixed(1)}%</p>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

interface CategoryChartProps {
  slices: CategoryBreakdownSlice[]
  isLoading?: boolean
}

export function CategoryChart({ slices, isLoading = false }: CategoryChartProps) {
  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-32 w-32 animate-pulse rounded-full bg-surface-2" />
      </div>
    )
  }

  if (slices.length === 0) {
    return <p className="mt-auto text-sm text-muted-foreground">ייבא עסקאות כדי לראות את הגרף.</p>
  }

  const chartData = slices.map(s => ({ name: s.category, value: s.amountAgorot, ...s }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={sliceColor(index)} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span className="text-xs text-muted-foreground">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
