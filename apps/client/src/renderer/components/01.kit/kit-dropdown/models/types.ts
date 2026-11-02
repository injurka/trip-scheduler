export interface KitDropdownItem<T = string> {
  value: T
  label: string
  icon?: string
  isDestructive?: boolean
  disabled?: boolean
}
