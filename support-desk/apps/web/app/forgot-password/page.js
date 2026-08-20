'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Link from 'next/link'
import Loading from '@/app/components/Loading'
import ErrorMessage from '@/app/components/ErrorMessage'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage('')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/update-password`,
    })

    if (error) setError(error)
    else setMessage('Password reset email sent. Please check your inbox.')

    setLoading(false)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMessage message={error.message} />

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold mb-4">Forgot Password</h1>

      <form onSubmit={handleReset} className="flex flex-col gap-3 w-72">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          Send Reset Email
        </button>
      </form>

      {message && <p className="text-green-600 mt-2">{message}</p>}

      <Link href="/login" className="mt-6 text-blue-600 hover:underline text-sm">
        ← Back to Login
      </Link>
    </div>
  )
}

