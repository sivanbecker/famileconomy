import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../store/auth'

const MOCK_USER = { id: 'user-1', name: 'Sivan', locale: 'he' as const }

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('starts with user=null', () => {
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('setUser stores the user', () => {
    useAuthStore.getState().setUser(MOCK_USER)
    expect(useAuthStore.getState().user).toEqual(MOCK_USER)
  })

  it('clearUser resets to null', () => {
    useAuthStore.getState().setUser(MOCK_USER)
    useAuthStore.getState().clearUser()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('user locale is preserved', () => {
    useAuthStore.getState().setUser({ ...MOCK_USER, locale: 'en' })
    expect(useAuthStore.getState().user?.locale).toBe('en')
  })
})
