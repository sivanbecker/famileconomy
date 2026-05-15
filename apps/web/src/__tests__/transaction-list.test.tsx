import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransactionList } from '../components/transaction-list'
import type { Transaction } from '../hooks/use-transactions'

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: '1',
    transactionDate: '2026-05-01',
    description: 'קפה',
    amountAgorot: 1500,
    category: 'מזון',
    cardLastFour: '5432',
    status: 'CLEARED',
    reviewStatus: null,
    installmentNum: null,
    installmentOf: null,
    notes: null,
    isMust: null,
    ...overrides,
  }
}

describe('TransactionList', () => {
  it('renders loading skeletons when isLoading is true', () => {
    const { container } = render(<TransactionList transactions={[]} isLoading={true} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders empty-state message when there are no transactions', () => {
    render(<TransactionList transactions={[]} isLoading={false} />)
    expect(screen.getByText(/אין עסקאות/)).toBeInTheDocument()
  })

  it('renders a transaction description', () => {
    render(<TransactionList transactions={[makeTx()]} isLoading={false} />)
    expect(screen.getByText('קפה')).toBeInTheDocument()
  })

  it('shows card last four as a badge', () => {
    render(<TransactionList transactions={[makeTx({ cardLastFour: '5432' })]} isLoading={false} />)
    expect(screen.getByText('5432')).toBeInTheDocument()
  })

  it('shows account name when cardLastFour is null', () => {
    render(
      <TransactionList
        transactions={[makeTx({ cardLastFour: null })]}
        isLoading={false}
        accountName="MAX כללי"
      />
    )
    expect(screen.getByText('MAX כללי')).toBeInTheDocument()
  })

  it('shows nothing in the card badge when cardLastFour is null and no accountName is provided', () => {
    render(<TransactionList transactions={[makeTx({ cardLastFour: null })]} isLoading={false} />)
    // Should not crash; card badge area simply empty
    expect(screen.getByText('קפה')).toBeInTheDocument()
  })

  it('assigns distinct color classes to different card last-four values', () => {
    const txs = [
      makeTx({ id: '1', cardLastFour: '1111' }),
      makeTx({ id: '2', cardLastFour: '2222' }),
    ]
    const { container } = render(<TransactionList transactions={txs} isLoading={false} />)
    const badges = container.querySelectorAll('[data-card-badge]')
    expect(badges.length).toBe(2)
    const class0 = badges[0]?.className ?? ''
    const class1 = badges[1]?.className ?? ''
    expect(class0).not.toBe(class1)
  })

  it('assigns the same color to the same card last-four value across rows', () => {
    const txs = [
      makeTx({ id: '1', cardLastFour: '5432' }),
      makeTx({ id: '2', cardLastFour: '5432' }),
    ]
    const { container } = render(<TransactionList transactions={txs} isLoading={false} />)
    const badges = container.querySelectorAll('[data-card-badge]')
    expect(badges[0]?.className).toBe(badges[1]?.className)
  })

  it('respects the limit prop', () => {
    const txs = Array.from({ length: 5 }, (_, i) =>
      makeTx({ id: String(i), description: `tx${i}` })
    )
    render(<TransactionList transactions={txs} isLoading={false} limit={3} />)
    expect(screen.queryAllByRole('listitem').length).toBe(3)
  })

  it('shows installment label when present', () => {
    render(
      <TransactionList
        transactions={[makeTx({ installmentNum: 2, installmentOf: 6 })]}
        isLoading={false}
      />
    )
    expect(screen.getByText(/2\/6/)).toBeInTheDocument()
  })
})
