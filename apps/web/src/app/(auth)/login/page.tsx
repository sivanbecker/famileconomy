'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { loginSchema, type LoginInput } from '../../../lib/schemas'
import { useAuthStore } from '../../../store/auth'
import { apiClient } from '../../../lib/api'
import { Button, Input } from '@famileconomy/ui'

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore(s => s.setUser)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginInput) {
    try {
      const res = await apiClient.post<{ id: string; name: string; locale: 'he' | 'en' }>(
        '/auth/login',
        data
      )
      setUser(res.data)
      router.push('/dashboard')
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.status === 401
          ? 'אימייל או סיסמה שגויים'
          : 'שגיאה בהתחברות'
      setError('root', { message })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-full max-w-sm flex-col gap-4 p-8"
        noValidate
      >
        <h1 className="text-2xl font-bold">התחברות</h1>

        <div className="flex flex-col gap-1">
          <label htmlFor="email">אימייל</label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password">סיסמה</label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
          {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
        </div>

        {errors.root && (
          <p role="alert" className="text-sm text-red-600">
            {errors.root.message}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'מתחבר...' : 'התחבר'}
        </Button>

        <p className="text-center text-sm">
          אין לך חשבון?{' '}
          <a href="/register" className="underline">
            הרשמה
          </a>
        </p>
      </form>
    </div>
  )
}
