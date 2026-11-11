import type { DocumentFile, DocumentFolder } from '../src/renderer/components/04.features/trip-info/trip-sections/documents-section/models/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useDocumentFolders } from '../src/renderer/components/04.features/trip-info/trip-sections/documents-section/composables/use-document-folders'
import Tree from '../src/renderer/components/04.features/trip-info/trip-sections/documents-section/ui/partials/documents-tree.vue'

const error = vi.hoisted(() => vi.fn())
vi.mock('~/shared/composables/use-confirm', () => ({ useConfirm: () => async () => true }))
vi.mock('~/shared/composables/use-toast', () => ({ useToast: () => ({ error }) }))
vi.mock('@iconify/vue', () => ({ Icon: { render: () => null } }))
const folders: DocumentFolder[] = [{ id: 'a', name: 'Азия' }, { id: 'b', name: 'Тайвань', parentId: 'a' }, { id: 'c', name: 'Билеты', parentId: 'b' }]
const file: DocumentFile = {
  id: 'doc',
  folderId: 'b',
  title: 'Билет.pdf',
  originalName: 'ticket.pdf',
  url: '/a.pdf',
  sizeBytes: 100,
  createdAt: '2026-11-11',
  access: 'private',
}
beforeEach(() => {
  error.mockClear()
  localStorage.clear()
})
async function setup(readonly = false, fail = false) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
  await router.push('/?folder=b')
  await router.isReady()
  const docs = ref<DocumentFile[]>([{ ...file }])
  const update = vi.fn(async (doc: DocumentFile) => {
    if (!fail)
      docs.value = [doc]
  })
  const emit = vi.fn()
  let api!: ReturnType<typeof useDocumentFolders>
  const wrapper = mount(defineComponent({
    setup() {
      api = useDocumentFolders(
        { section: { id: 's', tripId: 't', type: 'documents', content: { folders } }, readonly },
        emit,
        docs,
        ref(''),
        ref('all'),
        ref(false),
        update,
      )

      return () => h('div')
    },
  }), { global: { plugins: [router] } })

  return {
    api,
    docs,
    wrapper,
    emit,
    update,
  }
}
it('creates nested folders and gives complete breadcrumbs', async () => {
  const { api, wrapper, emit } = await setup()
  expect(api.breadcrumbs.value.map(f => f.name)).toEqual(['Все документы', 'Азия', 'Тайвань'])
  expect(api.visibleFolders.value.map(f => f.id)).toEqual(['c'])
  await api.addFolder('Отели')
  expect(api.folders.value.at(-1)?.parentId).toBe('b')
  expect(emit).toHaveBeenCalled()
  wrapper.unmount()
})
it('rejects cycles and blocks all folder edits in readonly mode', async () => {
  const editable = await setup()
  editable.api.updateFolder({ ...folders[0], parentId: 'c' })
  expect(error).toHaveBeenCalled()
  expect(editable.api.folders.value[0].parentId).toBeUndefined()
  editable.wrapper.unmount()
  const locked = await setup(true)
  await locked.api.addFolder('No')
  locked.api.renameFolder(folders[1], 'No')
  await locked.api.deleteFolder('b')
  expect(locked.emit).not.toHaveBeenCalled()
  locked.wrapper.unmount()
})
it('deleting a folder preserves children and files at its parent', async () => {
  const { api, docs, wrapper } = await setup()
  await api.deleteFolder('b')
  expect(docs.value[0].folderId).toBe('a')
  expect(api.folders.value.find(f => f.id === 'c')?.parentId).toBe('a')
  expect(api.currentFolderId.value).toBe('a')
  wrapper.unmount()
})
it('keeps the folder if a document move fails', async () => {
  const { api, wrapper, emit } = await setup(false, true)
  await api.deleteFolder('b')
  expect(api.folders.value.some(f => f.id === 'b')).toBe(true)
  expect(emit).not.toHaveBeenCalled()
  wrapper.unmount()
})
it('opens ancestors, searches nested files and keeps selection accessible', async () => {
  const wrapper = mount(Tree, {
    props: {
      folders,
      documents: [file],
      currentFolderId: 'b',
      selectedDocumentId: 'doc',
      readonly: false,
      storageKey: 's',
    },
  })
  expect(wrapper.text()).toContain('Билет.pdf')
  expect(wrapper.find('[aria-current="true"]').text()).toContain('Билет.pdf')
  await wrapper.get('input[type=search]').setValue('Билет.pdf')
  expect(wrapper.text()).toContain('Азия')
  await wrapper.findAll('button').find(b => b.text().includes('Билет.pdf'))!.trigger('click')
  expect(wrapper.emitted('selectDocument')?.[0]).toEqual([file])
  await flushPromises()
  wrapper.unmount()
})
