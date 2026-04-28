'use client'

import { useAuthStore } from '../../../../store/auth'
import { ImportForm } from '../../../../components/import-form'

export default function ImportPage() {
  const user = useAuthStore(s => s.user)

  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">ייבוא עסקאות</h1>
      <div className="max-w-md">
        <ImportForm userId={user.id} />
      </div>
    </div>
  )
}
