import { describe, it, expect } from 'vitest'
import { apiClient } from '../lib/api'

describe('apiClient', () => {
  it('has withCredentials set to true', () => {
    expect(apiClient.defaults.withCredentials).toBe(true)
  })

  it('has baseURL set from NEXT_PUBLIC_API_URL', () => {
    expect(apiClient.defaults.baseURL).toBeDefined()
  })

  it('has Content-Type application/json', () => {
    expect(
      apiClient.defaults.headers.common?.['Content-Type'] ??
        apiClient.defaults.headers['Content-Type']
    ).toBe('application/json')
  })
})
