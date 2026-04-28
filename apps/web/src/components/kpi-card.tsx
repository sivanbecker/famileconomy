import { formatILS } from '@famileconomy/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@famileconomy/ui'

interface KpiCardProps {
  label: string
  amountAgorot: number
}

export function KpiCard({ label, amountAgorot }: KpiCardProps) {
  const isNegative = amountAgorot < 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={isNegative ? 'text-red-600' : 'text-foreground'}
          data-negative={isNegative ? 'true' : undefined}
        >
          {formatILS(amountAgorot)}
        </p>
      </CardContent>
    </Card>
  )
}
