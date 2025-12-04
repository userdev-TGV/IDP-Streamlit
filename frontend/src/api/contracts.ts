import { apiClient, formClient } from './client'
import { ProcessedDocument } from '../types'

export const warmupDatabases = async () => {
  try {
    await apiClient.get('/warmup', { timeout: 2000 })
  } catch {
    // Ignorar errores, es solo para despertar la BD en segundo plano
  }
}

export const authLogin = async (accessId: string, pocId = 1) => {
  const { data } = await apiClient.post<{ access_id: string; poc_id: number; tokens_remaining: number }>(
    '/auth/login',
    { access_id: accessId, poc_id: pocId }
  )
  return data
}

export const consumeTokens = async (accessId: string, tokens = 1, pocId = 1) => {
  const { data } = await apiClient.post<{ tokens_remaining: number }>('/auth/consume', {
    access_id: accessId,
    poc_id: pocId,
    tokens,
  })
  return data
}

export const processDocument = async (
  file: File,
  options: { language?: string; customPrompt?: string }
): Promise<ProcessedDocument> => {
  const formData = new FormData()
  formData.append('file', file)
  if (options.language) {
    formData.append('language', options.language)
  }
  if (options.customPrompt) {
    formData.append('custom_prompt', options.customPrompt)
  }

  const { data } = await formClient.post<ProcessedDocument>('/process', formData)
  return data
}

export const chatWithDocument = async (
  extractedText: ProcessedDocument['extracted_text'],
  question: string
) => {
  const { data } = await apiClient.post<{ answer: string }>('/chat/document', {
    extracted_text: extractedText,
    question,
  })
  return data
}

export const chatWithDatabase = async (question: string) => {
  const { data } = await apiClient.post<{ answer: string }>('/chat/database', { question })
  return data
}

export const generateChart = async (prompt: string) => {
  const { data } = await apiClient.post<{ image: string; description: string }>('/charts', {
    prompt,
  })
  return data
}

export const downloadJson = async (payload: any) => {
  const { data } = await apiClient.post('/download/json', { data: payload }, { responseType: 'blob' })
  return data
}

export const downloadCsv = async (results: any[]) => {
  const { data } = await apiClient.post('/download/csv', { results }, { responseType: 'blob' })
  return data
}

export const requestTokens = async (name: string, email: string) => {
  const { data } = await apiClient.post<{ status: string; message: string }>('/tokens/request', { name, email })
  return data
}

export const requestSpecialist = async (payload: { name: string; email: string; company?: string; project?: string }) => {
  const { data } = await apiClient.post<{ status: string; message: string }>('/contact/specialist', payload)
  return data
}
