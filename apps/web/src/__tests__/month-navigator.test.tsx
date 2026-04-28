import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MonthNavigator } from '../components/month-navigator'

describe('MonthNavigator', () => {
  const baseProps = {
    year: 2026,
    month: 1,
    onPrev: vi.fn(),
    onNext: vi.fn(),
  }

  it('displays the month and year in Hebrew format', () => {
    render(<MonthNavigator {...baseProps} />)
    expect(screen.getByText(/ינואר/)).toBeInTheDocument()
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('calls onPrev when back button is clicked', () => {
    const onPrev = vi.fn()
    render(<MonthNavigator {...baseProps} onPrev={onPrev} />)
    fireEvent.click(screen.getByRole('button', { name: /prev|חודש קודם|הקודם/i }))
    expect(onPrev).toHaveBeenCalledOnce()
  })

  it('calls onNext when forward button is clicked', () => {
    const onNext = vi.fn()
    render(<MonthNavigator {...baseProps} onNext={onNext} />)
    fireEvent.click(screen.getByRole('button', { name: /next|חודש הבא|הבא/i }))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('disables next button when current month is today or later', () => {
    const now = new Date()
    render(<MonthNavigator {...baseProps} year={now.getFullYear()} month={now.getMonth() + 1} />)
    expect(screen.getByRole('button', { name: /next|חודש הבא|הבא/i })).toBeDisabled()
  })
})
