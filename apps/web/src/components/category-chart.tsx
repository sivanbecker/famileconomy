'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatILS } from '@famileconomy/utils'
import type { CategoryBreakdownSlice } from '@famileconomy/utils'

// ─── Helpers ────────────────────────────────────────────────────────────────

const CHART_VAR_NAMES = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'] as const

// Resolves CSS custom properties at runtime so SVG fill attributes receive
// computed values rather than unresolvable hsl(oklch(…)) strings.
function resolveChartColors(): string[] {
  if (typeof window === 'undefined') return CHART_VAR_NAMES.map(() => 'currentColor')
  const style = getComputedStyle(document.documentElement)
  return CHART_VAR_NAMES.map(v => style.getPropertyValue(v).trim() || 'currentColor')
}

function sliceColor(index: number, colors: string[]): string {
  return colors[index % colors.length] ?? colors[0] ?? 'currentColor'
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
        <div className="h-32 w-32 animate-pulse motion-reduce:animate-none rounded-full bg-surface-2" />
      </div>
    )
  }

  if (slices.length === 0) {
    return <p className="mt-auto text-sm text-muted-foreground">ייבא עסקאות כדי לראות את הגרף.</p>
  }

  const chartData = slices.map(s => ({ name: s.category, value: s.amountAgorot, ...s }))
  const colors = resolveChartColors()

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
            <Cell key={index} fill={sliceColor(index, colors)} />
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
