'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Loading from '@/app/components/Loading'
import ErrorMessage from '@/app/components/ErrorMessage'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) setError(error)
        else {
          setMessage('Login successful!')
          router.push('/admin/tickets')
    }

    setLoading(false)
  }

  if (loading) return <Loading />
  if (error) return <ErrorMessage message={error.message} />

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold mb-4">Login</h1>

      <form onSubmit={handleLogin} className="flex flex-col gap-3 w-72">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <button
          type="submit"
          className="bg-green-500 text-white p-2 rounded hover:bg-green-600"
        >
          Login
        </button>
      </form>

      {message && <p className="text-gray-700 mt-2">{message}</p>}

      <Link href="/forgot-password" className="text-blue-600 hover:underline text-sm mt-2">
        Forgot password?
      </Link>
    </div>
  )
}
