import { apiClient, formClient } from './client'
import { ProcessedDocument } from '../types'

export const processDocument = async (
  file: File,
  options: { language: string; customPrompt?: string }
): Promise<ProcessedDocument> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('language', options.language)
  if (options.customPrompt) {
    formData.append('custom_prompt', options.customPrompt)
  }

  const { data } = await formClient.post<ProcessedDocument>('/api/process', formData)
  return data
}

export const chatWithDocument = async (
  extractedText: ProcessedDocument['extracted_text'],
  question: string
) => {
  const { data } = await apiClient.post<{ answer: string }>('/api/chat/document', {
    extracted_text: extractedText,
    question,
  })
  return data
}

export const chatWithDatabase = async (file: File, question: string) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('question', question)
  const { data } = await formClient.post<{ answer: string; preview: any[] }>(
    '/api/chat/database',
    formData
  )
  return data
}

export const generateChart = async (prompt: string) => {
  const { data } = await apiClient.post<{ image: string; description: string }>('/api/charts', {
    prompt,
  })
  return data
}

export const downloadJson = async (payload: any) => {
  const { data } = await apiClient.post('/api/download/json', { data: payload }, { responseType: 'blob' })
  return data
}

export const downloadCsv = async (results: any[]) => {
  const { data } = await apiClient.post('/api/download/csv', { results }, { responseType: 'blob' })
  return data
}
