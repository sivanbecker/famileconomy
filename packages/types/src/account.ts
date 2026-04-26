export type AccountType = 'checking' | 'savings' | 'credit_card' | 'cash'

export type Account = {
  id: string
  userId: string
  name: string
  type: AccountType
  currency: 'ILS' | 'USD' | 'EUR'
  createdAt: Date
  updatedAt: Date
}
