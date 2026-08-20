'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function Navbar() {
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="w-full flex justify-between items-center bg-gray-100 px-6 py-3 shadow-sm">
      <div className="flex gap-4">
        <Link href="/" className="text-blue-600 hover:underline">
          Home
        </Link>
        <Link href="/todos" className="text-blue-600 hover:underline">
          To-Do
        </Link>
        <Link href="/admin/tickets" className="text-blue-600 hover:underline">
          Support Inbox
        </Link>
        <Link href="/admin/users" className="text-blue-600 hover:underline">
          Admin
        </Link>
        <Link href="/chat">AI Assistant</Link>
      </div>
      <button
        onClick={handleLogout}
        className="text-red-500 hover:underline text-sm"
      >
        Log Out
      </button>
    </nav>
  )
}
