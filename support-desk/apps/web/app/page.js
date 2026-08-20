'use client'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 text-center px-6">
      <h1 className="text-3xl font-bold">Zeybek Hukuk Bürosu</h1>
      <p className="text-gray-600 max-w-md">
        Ask our AI assistant about practice areas, office hours, or how to book a consultation —
        it&apos;ll answer directly or pass your question to a member of the team.
      </p>

      <Link
        href="/chat"
        className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
      >
        Ask a question
      </Link>

      <Link href="/login" className="text-sm text-gray-500 hover:underline">
        Staff login
      </Link>
    </div>
  )
}
