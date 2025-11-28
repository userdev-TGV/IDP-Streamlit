export interface ExtractedLine {
  text: string
  confidence: number
  page?: number
}

export interface Metrics {
  textract_duration: number
  openai_duration: number
  total_text_lines: number
  page_count: number
  saved_images?: string[]
}

export interface ProcessedDocument {
  openai_response: any
  metrics: Metrics
  extracted_text: ExtractedLine[]
  file_name: string
  language: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
