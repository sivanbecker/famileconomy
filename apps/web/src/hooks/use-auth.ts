'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../store/auth'
import { apiClient } from '../lib/api'

interface MeResponse {
  id: string
  name: string
  locale: 'he' | 'en'
}

export function useAuth() {
  const { user, setUser, clearUser } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (user) return
    apiClient
      .get<MeResponse>('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => {
        clearUser()
        router.push('/login')
      })
  }, [user, setUser, clearUser, router])

  return { user }
}
