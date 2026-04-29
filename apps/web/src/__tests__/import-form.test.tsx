import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportForm } from '../components/import-form'

vi.mock('../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { apiClient } from '../lib/api'

const MOCK_ACCOUNTS = [
  { id: 'acc-1', name: 'Max 5432', type: 'CREDIT_CARD' },
  { id: 'acc-2', name: 'Cal 1234', type: 'CREDIT_CARD' },
]

describe('ImportForm', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { accounts: MOCK_ACCOUNTS } })
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { inserted: 3, duplicates: 0, errors: [] },
    })
  })

  it('renders file input and account selector', async () => {
    render(<ImportForm userId="user-1" />)
    await waitFor(() => expect(screen.getByLabelText(/קובץ/i)).toBeInTheDocument())
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('loads accounts into the selector', async () => {
    render(<ImportForm userId="user-1" />)
    await waitFor(() => expect(screen.getByText('Max 5432')).toBeInTheDocument())
    expect(screen.getByText('Cal 1234')).toBeInTheDocument()
  })

  it('shows validation error when no file is selected and form is submitted', async () => {
    render(<ImportForm userId="user-1" />)
    await waitFor(() => screen.getByRole('button', { name: /ייבא|import/i }))
    fireEvent.click(screen.getByRole('button', { name: /ייבא|import/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('shows success message after successful import', async () => {
    const user = userEvent.setup()
    render(<ImportForm userId="user-1" />)
    await waitFor(() => screen.getByRole('combobox'))

    const file = new File(['date,amount\n2026-01-01,100'], 'test.csv', { type: 'text/csv' })
    const input = screen.getByLabelText(/קובץ/i)
    await user.upload(input, file)

    fireEvent.click(screen.getByRole('button', { name: /ייבא|import/i }))
    await waitFor(() => expect(screen.getByText(/יובאו 3 עסקאות/i)).toBeInTheDocument())
  })

  it('shows error message when import returns FILE_ALREADY_IMPORTED', async () => {
    const { AxiosError } = await import('axios')
    vi.mocked(apiClient.post).mockRejectedValue(
      Object.assign(new AxiosError('conflict'), {
        response: { status: 409, data: { message: 'You already imported this file!' } },
      })
    )

    const user = userEvent.setup()
    render(<ImportForm userId="user-1" />)
    await waitFor(() => screen.getByRole('combobox'))

    const file = new File(['date,amount'], 'test.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText(/קובץ/i), file)
    fireEvent.click(screen.getByRole('button', { name: /ייבא|import/i }))

    await waitFor(() => expect(screen.getByText(/כבר יובא|already imported/i)).toBeInTheDocument())
  })
})
