import { createContext, useContext, useMemo, useState, ReactNode } from 'react'
import type { AxiosError } from 'axios'
import { authLogin, consumeTokens } from '../api/contracts'

type User = { name: string; accessId: string; pocId: number; tokens: number }

type AuthContextShape = {
  user: User | null
  isAuthenticated: boolean
  tokensRemaining: number
  login: (payload: { accessId: string }) => Promise<void>
  consume: (feature: string, tokens?: number) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextShape | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [tokensRemaining, setTokensRemaining] = useState<number>(0)

  const login = async ({ accessId }: { accessId: string }) => {
    try {
      const data = await authLogin(accessId)
      setUser({
        name: accessId,
        accessId: data.access_id,
        pocId: data.poc_id,
        tokens: data.tokens_remaining,
      })
      setTokensRemaining(data.tokens_remaining)
      // Reinicia el tour para mostrar el popup tras login
      try {
        localStorage.removeItem('idp-tour-seen')
      } catch {
        // ignore
      }
    } catch (err) {
      const ax = err as AxiosError<{ detail?: string }>
      const detail = ax.response?.data?.detail
      throw new Error(detail || ax.message)
    }
  }

  const consume = async (feature: string, tokens = 1) => {
    if (!user) throw new Error('No autenticado')
    if (tokensRemaining <= 0) throw new Error('Sin créditos disponibles')
    const data = await consumeTokens(user.accessId, tokens, user.pocId)
    setTokensRemaining(data.tokens_remaining)
    setUser((prev) =>
      prev
        ? {
            ...prev,
            tokens: data.tokens_remaining,
          }
        : prev
    )
  }

  const logout = () => setUser(null)

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      tokensRemaining,
      login,
      consume,
      logout,
    }),
    [user, tokensRemaining]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
