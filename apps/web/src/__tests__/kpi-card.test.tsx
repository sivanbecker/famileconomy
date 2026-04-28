import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiCard } from '../components/kpi-card'

describe('KpiCard', () => {
  it('renders the label', () => {
    render(<KpiCard label="הכנסות" amountAgorot={500000} />)
    expect(screen.getByText('הכנסות')).toBeInTheDocument()
  })

  it('formats amountAgorot as ILS display value', () => {
    render(<KpiCard label="הכנסות" amountAgorot={500000} />)
    expect(screen.getByText(/5,000/)).toBeInTheDocument()
  })

  it('shows zero correctly', () => {
    render(<KpiCard label="הוצאות" amountAgorot={0} />)
    expect(screen.getByText(/0/)).toBeInTheDocument()
  })

  it('renders negative amount with minus sign', () => {
    render(<KpiCard label="מאזן" amountAgorot={-150000} />)
    expect(screen.getByText(/-/)).toBeInTheDocument()
  })

  it('applies negative styling when amountAgorot is negative', () => {
    const { container } = render(<KpiCard label="מאזן" amountAgorot={-150000} />)
    expect(container.querySelector('[data-negative="true"]')).toBeInTheDocument()
  })
})
