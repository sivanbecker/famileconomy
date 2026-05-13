import { formatILS } from '@famileconomy/utils'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  sublabel?: string
  amountAgorot: number
  budgetAgorot?: number
  icon: LucideIcon
  variant?: 'default' | 'positive' | 'negative' | 'highlight'
}

function variantAmountClass(variant: KpiCardProps['variant']): string {
  if (variant === 'positive') return 'text-primary'
  if (variant === 'negative') return 'text-destructive'
  if (variant === 'highlight') return 'text-secondary'
  return 'text-foreground'
}

function variantIconClass(variant: KpiCardProps['variant']): string {
  if (variant === 'positive') return 'bg-primary/10 text-primary'
  if (variant === 'negative') return 'bg-destructive/10 text-destructive'
  if (variant === 'highlight') return 'bg-secondary/10 text-secondary'
  return 'bg-surface-2 text-muted-foreground'
}

export function KpiCard({
  label,
  sublabel,
  amountAgorot,
  budgetAgorot,
  icon: Icon,
  variant = 'default',
}: KpiCardProps) {
  const isNegative = amountAgorot < 0

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card-md">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-md ${variantIconClass(variant)}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <p
        className={`text-display-sm font-extrabold ${isNegative ? 'text-destructive' : variantAmountClass(variant)}`}
        data-negative={isNegative ? 'true' : undefined}
      >
        {formatILS(amountAgorot)}
      </p>

      {budgetAgorot !== undefined && (
        <p className="text-label-md text-muted-foreground">
          {sublabel ?? 'מתוכנן:'} {formatILS(budgetAgorot)}
        </p>
      )}
    </div>
  )
}
