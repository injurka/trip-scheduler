export interface IconCategory {
  id: string
  label: string
  icon: string
  icons: string[]
}

export interface IconPickerProps {
  modelValue?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  align?: 'start' | 'center' | 'end'
  inline?: boolean
}
