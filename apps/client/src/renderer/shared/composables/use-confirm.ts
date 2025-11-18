/**
 * Composable for showing a global confirmation dialog.
 * @returns A confirm function that returns a promise resolving to `true` if confirmed, `false` otherwise.
 * @example
 * const confirm = useConfirm()
 *
 * async function deleteItem() {
 *   if (await confirm({ title: 'Are you sure?', description: 'This action cannot be undone.' })) {
 *     // ...delete logic
 *   }
 * }
 */
export function useConfirm() {
  const store = useAppStore(['confirmDialog'])

  return store.confirmDialog.open
}
