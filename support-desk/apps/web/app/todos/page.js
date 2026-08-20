'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Loading from '@/app/components/Loading'
import ErrorMessage from '@/app/components/ErrorMessage'

export default function TodosPage() {
  const [todos, setTodos] = useState([])
  const [newTodo, setNewTodo] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Pure data loader — does not touch state, so it's safe to call from an
  // effect (after an await) as well as from event handlers.
  async function loadTodos() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw { message: 'Please log in to view your to-do list.' }
    }

    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  }

  async function fetchTodos() {
    setLoading(true)
    setError(null)
    try {
      const data = await loadTodos()
      setTodos(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function initialLoad() {
      setLoading(true)
      setError(null)
      try {
        const data = await loadTodos()
        setTodos(data)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }

    initialLoad()
  }, [])

  async function handleAddTodo(e) {
    e.preventDefault()
    if (!newTodo.trim() || submitting) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError({ message: 'You must be logged in.' })
      setSubmitting(false)
      return
    }

    const { error } = await supabase
      .from('todos')
      .insert([{ title: newTodo.trim(), user_id: user.id }])

    if (error) setError(error)
    else {
      setNewTodo('')
      await fetchTodos()
    }
    setSubmitting(false)
  }

  async function handleToggle(todo) {
    // Optimistic update — toggle immediately in UI
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, is_complete: !t.is_complete } : t
      )
    )

    const { error } = await supabase
      .from('todos')
      .update({ is_complete: !todo.is_complete })
      .eq('id', todo.id)

    if (error) {
      setError(error)
      // Revert on failure
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id ? { ...t, is_complete: todo.is_complete } : t
        )
      )
    }
  }

  async function handleDelete(todoId) {
    // Optimistic update — remove immediately from UI
    setTodos((prev) => prev.filter((t) => t.id !== todoId))

    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', todoId)

    if (error) {
      setError(error)
      await fetchTodos() // Re-fetch on failure to restore correct state
    }
  }

  if (loading) return <Loading />
  if (error) return <ErrorMessage message={error.message} />

  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">My To-Do List</h1>

      {/* Add New To-Do */}
      <form onSubmit={handleAddTodo} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Add a new task"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          className="border p-2 rounded w-64"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting || !newTodo.trim()}
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {submitting ? 'Adding...' : 'Add'}
        </button>
      </form>

      {/* List To-Dos */}
      <ul className="w-full max-w-md">
        {todos.length === 0 && <p>No tasks yet.</p>}
        {todos.map((todo) => (
          <li key={todo.id} className="flex justify-between items-center border-b py-2">
            <span
              onClick={() => handleToggle(todo)}
              className={`cursor-pointer ${todo.is_complete ? 'line-through text-gray-500' : ''}`}
            >
              {todo.title}
            </span>
            <button
              onClick={() => handleDelete(todo.id)}
              className="text-red-500 hover:underline text-sm"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
