'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Loading from '@/app/components/Loading'
import ErrorMessage from '@/app/components/ErrorMessage'

export default function AdminTicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function checkAccessAndFetchTickets() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError || profile.role !== 'super_admin') {
        setLoading(false)
        router.push('/')
        return
      }

      const { data, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, session_id, subject, message, status, created_at')
        .order('created_at', { ascending: false })

      if (ticketsError) {
        console.error(ticketsError)
        setError(ticketsError)
        setLoading(false)
        return
      }

      setTickets(data)
      setLoading(false)
    }

    checkAccessAndFetchTickets()
  }, [router])

  async function handleResolve(ticketId) {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: 'resolved' } : t))
    )

    const { error: updateError } = await supabase
      .from('tickets')
      .update({ status: 'resolved' })
      .eq('id', ticketId)

    if (updateError) {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: 'open' } : t))
      )
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorMessage message={error.message} />

  const openTickets = tickets.filter((t) => t.status === 'open')
  const resolvedTickets = tickets.filter((t) => t.status === 'resolved')

  return (
    <div className="flex flex-col items-center min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-2">Support Inbox</h1>
      <p className="text-gray-500 mb-6">
        Questions the AI assistant couldn&apos;t confidently answer on its own.
      </p>

      <div className="w-full max-w-3xl">
        <h2 className="text-lg font-semibold mb-3">Open ({openTickets.length})</h2>
        {openTickets.length === 0 && (
          <p className="text-gray-500 mb-6">Nothing waiting on you right now.</p>
        )}
        <ul className="flex flex-col gap-3 mb-8">
          {openTickets.map((ticket) => (
            <li key={ticket.id} className="border rounded p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">{ticket.subject}</span>
                <button
                  onClick={() => handleResolve(ticket.id)}
                  className="text-sm text-green-600 hover:underline"
                >
                  Mark resolved
                </button>
              </div>
              <p className="text-gray-700 text-sm mb-2">{ticket.message}</p>
              <p className="text-xs text-gray-400">
                {new Date(ticket.created_at).toLocaleString()} · session {ticket.session_id.slice(0, 8)}
              </p>
            </li>
          ))}
        </ul>

        {resolvedTickets.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mb-3">Resolved ({resolvedTickets.length})</h2>
            <ul className="flex flex-col gap-3">
              {resolvedTickets.map((ticket) => (
                <li key={ticket.id} className="border rounded p-4 opacity-60">
                  <span className="font-semibold">{ticket.subject}</span>
                  <p className="text-gray-700 text-sm mt-1">{ticket.message}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Link href="/admin/users" className="mt-8 text-sm text-blue-600 hover:underline">
        View user management →
      </Link>
    </div>
  )
}
