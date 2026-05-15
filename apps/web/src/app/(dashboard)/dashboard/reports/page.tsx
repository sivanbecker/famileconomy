'use client'

import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { BarChart2, TrendingUp, AreaChart as AreaChartIcon } from 'lucide-react'
import { formatILS } from '@famileconomy/utils'
import { AccountSelector } from '../../../../components/account-selector'
import { useAuth } from '../../../../hooks/use-auth'
import { useAccountStore } from '../../../../store/account'
import { buildMonthRange, useMultiMonthTransactions } from '../../../../hooks/use-multi-month'
import type { MonthDataPoint } from '../../../../hooks/use-multi-month'

// ─── Types ────────────────────────────────────────────────────────────────────

type Range = 3 | 6 | 12 | 24
type ChartType = 'bar' | 'line' | 'area'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveColor(varName: string): string {
  if (typeof window === 'undefined') return 'currentColor'
  return (
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || 'currentColor'
  )
}

// ─── Custom tooltip — expenses chart ─────────────────────────────────────────

interface ExpensesTooltipProps {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}

function ExpensesTooltip({ active, payload, label }: ExpensesTooltipProps) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value ?? 0
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-destructive">{formatILS(value)}</p>
    </div>
  )
}

// ─── Custom tooltip — ratio chart ────────────────────────────────────────────

interface RatioTooltipProps {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}

function RatioTooltip({ active, payload, label }: RatioTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value.toFixed(1)}%
        </p>
      ))}
    </div>
  )
}

// ─── Expenses chart ───────────────────────────────────────────────────────────

interface ExpensesChartProps {
  data: MonthDataPoint[]
  chartType: ChartType
  isLoading: boolean
}

function ExpensesChart({ data, chartType, isLoading }: ExpensesChartProps) {
  if (isLoading) {
    return (
      <div className="flex h-56 items-end gap-1 px-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-surface-2"
            style={{ height: `${30 + ((i * 17) % 60)}%` }}
          />
        ))}
      </div>
    )
  }

  const chartData = data.map(d => ({ name: d.label, value: d.totalAgorot }))
  const color = resolveColor('--destructive')

  const commonProps = {
    data: chartData,
    margin: { top: 4, right: 16, left: 0, bottom: 0 },
  }

  const axisProps = {
    xAxis: <XAxis dataKey="name" tick={{ fontSize: 11 }} />,
    yAxis: (
      <YAxis
        tick={{ fontSize: 11 }}
        tickFormatter={(v: number) => formatILS(v).replace('₪', '').trim()}
        width={60}
      />
    ),
    grid: <CartesianGrid strokeDasharray="3 3" className="stroke-border" />,
    tooltip: <Tooltip content={<ExpensesTooltip />} />,
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      {chartType === 'line' ? (
        <LineChart {...commonProps}>
          {axisProps.grid}
          {axisProps.xAxis}
          {axisProps.yAxis}
          {axisProps.tooltip}
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      ) : chartType === 'area' ? (
        <AreaChart {...commonProps}>
          {axisProps.grid}
          {axisProps.xAxis}
          {axisProps.yAxis}
          {axisProps.tooltip}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={`${color}22`}
            strokeWidth={2}
          />
        </AreaChart>
      ) : (
        <BarChart {...commonProps}>
          {axisProps.grid}
          {axisProps.xAxis}
          {axisProps.yAxis}
          {axisProps.tooltip}
          <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}

// ─── Ratio chart ──────────────────────────────────────────────────────────────

interface RatioChartProps {
  data: MonthDataPoint[]
  isLoading: boolean
}

function RatioChart({ data, isLoading }: RatioChartProps) {
  if (isLoading) {
    return (
      <div className="flex h-56 items-end gap-1 px-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-surface-2"
            style={{ height: '80%' }}
          />
        ))}
      </div>
    )
  }

  const primary = resolveColor('--primary')
  const muted = resolveColor('--muted-foreground')

  const chartData = data.map(d => ({
    name: d.label,
    חיוני: d.totalAgorot > 0 ? parseFloat((100 - d.niceToHavePct).toFixed(1)) : 0,
    'לא חיוני': d.totalAgorot > 0 ? parseFloat(d.niceToHavePct.toFixed(1)) : 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 100]} width={40} />
        <Tooltip content={<RatioTooltip />} />
        <Legend iconType="circle" iconSize={8} />
        <Bar dataKey="חיוני" stackId="a" fill={primary} />
        <Bar dataKey="לא חיוני" stackId="a" fill={muted} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const RANGES: { label: string; value: Range }[] = [
  { label: '3M', value: 3 },
  { label: '6M', value: 6 },
  { label: '12M', value: 12 },
  { label: '24M', value: 24 },
]

const CHART_TYPES: { label: string; value: ChartType; icon: React.ReactNode }[] = [
  { label: 'עמודות', value: 'bar', icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { label: 'קו', value: 'line', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { label: 'שטח', value: 'area', icon: <AreaChartIcon className="h-3.5 w-3.5" /> },
]

export default function ReportsPage() {
  const now = new Date()
  const [range, setRange] = useState<Range>(12)
  const [chartType, setChartType] = useState<ChartType>('bar')

  const { user } = useAuth()
  const { activeAccountId } = useAccountStore()

  const months = useMemo(
    () => buildMonthRange(now.getFullYear(), now.getMonth() + 1, range),
    [range] // now is stable (component mount time)
  )

  const { data, isLoading } = useMultiMonthTransactions(activeAccountId, user?.id, months)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Top bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-display-sm">דוחות</h1>
        <div className="flex items-center gap-3">
          {user && <AccountSelector userId={user.id} />}
          {/* Range selector */}
          <div className="flex rounded-md border border-border bg-background">
            {RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-s-md last:rounded-e-md ${
                  range === r.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Expenses over time ── */}
      <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card-md">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">הוצאות לאורך זמן</h2>
          {/* Chart type switcher */}
          <div className="flex rounded-md border border-border bg-background">
            {CHART_TYPES.map(ct => (
              <button
                key={ct.value}
                onClick={() => setChartType(ct.value)}
                title={ct.label}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors first:rounded-s-md last:rounded-e-md ${
                  chartType === ct.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {ct.icon}
              </button>
            ))}
          </div>
        </div>
        <ExpensesChart data={data} chartType={chartType} isLoading={isLoading} />
      </div>

      {/* ── Must / Nice-to-have ratio over time ── */}
      <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card-md">
        <h2 className="font-semibold">יחס חיוני / לא חיוני לאורך זמן</h2>
        <p className="text-xs text-muted-foreground">
          אחוז מתוך סך ההוצאות בכל חודש — ניתן לראות האם ההוצאות הלא-חיוניות גדלות עם הזמן
        </p>
        <RatioChart data={data} isLoading={isLoading} />
      </div>
    </div>
  )
}
