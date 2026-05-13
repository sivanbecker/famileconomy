'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { registerSchema, type RegisterInput } from '../../../lib/schemas'
import { useAuthStore } from '../../../store/auth'
import { apiClient } from '../../../lib/api'
import { Button, Input } from '@famileconomy/ui'

export default function RegisterPage() {
  const router = useRouter()
  const setUser = useAuthStore(s => s.setUser)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { locale: 'he' },
  })

  async function onSubmit(data: RegisterInput) {
    try {
      const res = await apiClient.post<{
        user: { id: string; name: string; locale: 'he' | 'en' }
        accessToken: string
      }>('/auth/register', data)
      setUser(res.data.user)
      router.push('/dashboard')
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.status === 409
          ? 'האימייל כבר רשום במערכת'
          : 'שגיאה בהרשמה'
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
        <h1 className="text-display-md">הרשמה</h1>

        <div className="flex flex-col gap-1">
          <label htmlFor="name">שם</label>
          <Input id="name" type="text" autoComplete="name" {...register('name')} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email">אימייל</label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password">סיסמה</label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
          />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <input type="hidden" {...register('locale')} />

        {errors.root && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'נרשם...' : 'הרשמה'}
        </Button>

        <p className="text-center text-sm">
          יש לך חשבון?{' '}
          <a href="/login" className="underline">
            התחברות
          </a>
        </p>
      </form>
    </div>
  )
}
