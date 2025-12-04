import axios from 'axios'

// Normalize base URL so we always end up hitting the API root once (no double /api/api).
const rawBase =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || 'http://localhost:8000'
const baseURL = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`

export const apiClient = axios.create({
  baseURL,
})

export const formClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'multipart/form-data' },
})
