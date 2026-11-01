import { useContext } from 'react'
import { DemoContext } from './DemoContext'

export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('useDemo must be used within DemoProvider')
  return context
}
