import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model'
import type { NodeView } from '@milkdown/kit/prose/view'
import type { TripNote } from '~/shared/services/api/model/types'
import { parseMarkdownChecklistTasks } from './markdown-checklist'

const MESSAGE_CHANNEL = 'trip-scheduler-dataviewjs'

export interface DataviewJsRendererOptions {
  getNotes: () => TripNote[]
  currentNoteId: string
  readonly: () => boolean
  toggleTask: (payload: { noteId: string, lineIndex: number }) => void
}

interface DataviewPageFile {
  noteId: string
  name: string
  path: string
  folder: string
  link: string
  tags: string[]
  tasks: Array<{
    noteId: string
    noteTitle: string
    lineIndex: number
    indent: number
    parentLineIndex: number | null
    text: string
    completed: boolean
    file: { name: string, path: string, link: string }
  }>
}

interface DataviewPage {
  file: DataviewPageFile
  [key: string]: unknown
}

function buildPages(notes: TripNote[]): DataviewPage[] {
  const byId = new Map(notes.map(note => [note.id, note]))

  function pathFor(note: TripNote): string {
    const parts = [note.title.replace(/\.md$/i, '')]
    let parent = note.parentId ? byId.get(note.parentId) : undefined
    const visited = new Set<string>()

    while (parent && !visited.has(parent.id)) {
      visited.add(parent.id)
      parts.unshift(parent.title.replace(/\.md$/i, ''))
      parent = parent.parentId ? byId.get(parent.parentId) : undefined
    }

    return parts.join('/')
  }

  return notes
    .filter(note => note.type === 'markdown')
    .map((note) => {
      const fullPath = pathFor(note)
      const segments = fullPath.split('/')
      const name = segments.pop() ?? note.title
      const folder = segments.join('/')
      const path = `${fullPath}.md`
      const fileLink = `[[${path}|${name}]]`
      const tasks = parseMarkdownChecklistTasks(note).map(task => ({
        noteId: task.noteId,
        noteTitle: task.noteTitle,
        lineIndex: task.lineIndex,
        indent: task.indent,
        parentLineIndex: task.parentLineIndex,
        text: task.text,
        completed: task.completed,
        file: { name, path, link: fileLink },
      }))
      const tags = [...new Set((note.content ?? '').match(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)?.map(tag => tag.trim().replace(/^#/, '')) ?? [])]
      const file: DataviewPageFile = {
        noteId: note.id,
        name,
        path,
        folder,
        link: fileLink,
        tags,
        tasks,
      }

      return {
        file,
        tags,
      }
    })
}

function serializeForScript(value: unknown): string {
  return (JSON.stringify(value) ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function createSandboxDocument(
  code: string,
  pages: DataviewPage[],
  currentNoteId: string,
  token: string,
  readonly: boolean,
  linkColor: string,
): string {
  const script = `(() => {
    const token = ${serializeForScript(token)};
    const payload = ${serializeForScript({ pages, currentNoteId, readonly })};
    document.documentElement.style.setProperty('--dataview-link-color', ${serializeForScript(linkColor)});
    const root = document.getElementById('output');
    const status = document.getElementById('status');
    const send = (message) => window.parent.postMessage({ channel: '${MESSAGE_CHANNEL}', token, ...message }, '*');

    const asArray = (items) => {
      const values = Array.from(items || []);
      return new Proxy(values, {
        get(target, property) {
          if (property === 'where' || property === 'filter')
            return predicate => asArray(target.filter(predicate));
          if (property === 'map')
            return mapper => asArray(target.map(mapper));
          if (property === 'flatMap')
            return mapper => asArray(target.flatMap(mapper));
          if (property === 'sort') {
            return (selector, reverse = false) => {
              const sorted = [...target];
              sorted.sort((a, b) => {
                const left = typeof selector === 'function' ? selector(a) : a;
                const right = typeof selector === 'function' ? selector(b) : b;
                if (left < right) return reverse ? 1 : -1;
                if (left > right) return reverse ? -1 : 1;
                return 0;
              });
              return asArray(sorted);
            };
          }
          if (property === 'array')
            return () => [...target];
          if (property === 'first')
            return () => target[0];
          if (property === 'last')
            return () => target[target.length - 1];
          if (property === 'file')
            return asArray(target.map(item => item?.file).filter(Boolean));
          if (property === 'tasks')
            return asArray(target.flatMap(item => Array.from(item?.tasks || [])));
          if (property === 'length')
            return target.length;
          if (typeof property === 'string' && target.length && property in Object(target[0]))
            return asArray(target.map(item => item?.[property]));
          const result = Reflect.get(target, property, target);
          return typeof result === 'function' ? result.bind(target) : result;
        },
      });
    };

    const pages = payload.pages.map(page => ({
      ...page,
      file: { ...page.file, tasks: asArray(page.file.tasks), tags: asArray(page.file.tags) },
      tags: asArray(page.tags),
    }));
    const current = pages.find(page => page.file.noteId === payload.currentNoteId);
    const sourcePages = (source) => {
      const query = String(source || '').trim();
      if (!query) return asArray(pages);
      const folder = /^"([\\s\\S]+)"$/.exec(query)?.[1] || /^'([\\s\\S]+)'$/.exec(query)?.[1];
      if (folder)
        return asArray(pages.filter(page => page.file.folder === folder || page.file.folder.startsWith(folder + '/')));
      if (query.startsWith('#')) {
        const wanted = query.slice(1).toLowerCase();
        return asArray(pages.filter(page => page.file.tags.some(tag => tag.toLowerCase() === wanted)));
      }
      return asArray([]);
    };

    const appendInline = (parent, input) => {
      const text = String(input ?? '');
      const tokenPattern = /<progress\\b[^>]*><\\/progress>|\\[([^\\]]+)\\]\\(([^\\s)]+)\\)|\\*\\*([\\s\\S]+?)\\*\\*|__([\\s\\S]+?)__|~~([\\s\\S]+?)~~|\\*([^*\\n]+?)\\*|_([^_\\n]+?)_/gi;
      let cursor = 0;
      let match;
      while ((match = tokenPattern.exec(text)) !== null) {
        if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
        if (match[1] !== undefined) {
          let href = null;
          try {
            const url = new URL(match[2], document.baseURI);
            if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) href = url.href;
          }
          catch {}
          if (href) {
            const link = document.createElement('a');
            link.href = href;
            link.rel = 'noopener noreferrer';
            link.className = 'dataview-link';
            appendInline(link, match[1]);
            parent.append(link);
          }
          else {
            appendInline(parent, match[1]);
          }
        }
        else if (match[3] !== undefined || match[4] !== undefined) {
          const strong = document.createElement('strong');
          appendInline(strong, match[3] ?? match[4]);
          parent.append(strong);
        }
        else if (match[5] !== undefined) {
          const deleted = document.createElement('del');
          appendInline(deleted, match[5]);
          parent.append(deleted);
        }
        else if (match[6] !== undefined || match[7] !== undefined) {
          const emphasis = document.createElement('em');
          appendInline(emphasis, match[6] ?? match[7]);
          parent.append(emphasis);
        }
        else {
          const progressMatch = /\\bvalue\\s*=\\s*["']?([0-9.]+)/i.exec(match[0]);
          const maxMatch = /\\bmax\\s*=\\s*["']?([0-9.]+)/i.exec(match[0]);
          const progress = document.createElement('progress');
          progress.value = Number(progressMatch?.[1] ?? 0);
          progress.max = Math.max(1, Number(maxMatch?.[1] ?? 1));
          parent.append(progress);
        }
        cursor = tokenPattern.lastIndex;
      }
      if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
    };

    const renderElement = (tag, text) => {
      const allowed = new Set(['p', 'span', 'div', 'strong', 'b', 'em', 'i', 'code', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
      const element = document.createElement(allowed.has(String(tag).toLowerCase()) ? String(tag).toLowerCase() : 'span');
      appendInline(element, text);
      root.append(element);
      sendHeight();
      return element;
    };

    const taskList = (input, groupByFile = true) => {
      const selectedTasks = Array.from(input || []);
      const taskId = task => task.noteId + ':' + task.lineIndex;
      const included = new Map();
      for (const selectedTask of selectedTasks) {
        let task = selectedTask;
        const sourceTasks = payload.pages.find(page => page.file.noteId === selectedTask.noteId)?.file.tasks || [];
        while (task) {
          included.set(taskId(task), task);
          if (task.parentLineIndex == null) break;
          task = sourceTasks.find(candidate => candidate.lineIndex === task.parentLineIndex);
        }
      }
      const tasks = Array.from(included.values());
      const groups = new Map();
      for (const task of tasks) {
        const key = groupByFile ? task.file?.path || task.noteId : '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(task);
      }
      for (const [key, group] of groups) {
        if (groupByFile && group.length) {
          const heading = document.createElement('h5');
          heading.textContent = group[0].file?.name || group[0].noteTitle || key;
          root.append(heading);
        }
        const sortedGroup = [...group].sort((a, b) => a.lineIndex - b.lineIndex);
        const nodes = new Map(sortedGroup.map(task => [taskId(task), { task, children: [] }]));
        const roots = [];
        for (const task of sortedGroup) {
          const node = nodes.get(taskId(task));
          const parent = task.parentLineIndex == null ? null : nodes.get(task.noteId + ':' + task.parentLineIndex);
          if (parent) parent.children.push(node);
          else roots.push(node);
        }
        const list = document.createElement('ul');
        list.className = 'task-list';
        const appendTaskNodes = (target, taskNodes) => {
          for (const node of taskNodes) {
            const task = node.task;
            const item = document.createElement('li');
            const row = document.createElement('div');
            row.className = 'task-row';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = Boolean(task.completed);
            checkbox.disabled = payload.readonly;
            checkbox.addEventListener('change', () => send({
              type: 'toggle-task',
              noteId: task.noteId,
              lineIndex: task.lineIndex,
            }));
            const label = document.createElement('span');
            appendInline(label, task.text);
            row.append(checkbox, label);
            item.append(row);
            if (node.children.length) {
              const nested = document.createElement('ul');
              nested.className = 'task-list task-list-nested';
              appendTaskNodes(nested, node.children);
              item.append(nested);
            }
            target.append(item);
          }
        };
        appendTaskNodes(list, roots);
        root.append(list);
      }
      sendHeight();
    };

    const renderList = (input) => {
      const list = document.createElement('ul');
      for (const value of Array.from(input || [])) {
        const item = document.createElement('li');
        appendInline(item, value?.file?.link || value?.file?.name || value?.text || value);
        list.append(item);
      }
      root.append(list);
      sendHeight();
    };

    const dv = {
      current: () => current,
      pages: source => sourcePages(source),
      page: path => pages.find(page => page.file.path === path || page.file.name === path || page.file.path.replace(/\\.md$/i, '') === path),
      paragraph: text => renderElement('p', text),
      span: text => renderElement('span', text),
      el: (tag, text) => renderElement(tag, text),
      header: (level, text) => renderElement('h' + Math.max(1, Math.min(6, Number(level) || 1)), text),
      list: values => renderList(values),
      taskList,
      array: values => asArray(values),
      fileLink: path => ({ path: String(path), display: String(path) }),
      table: (headers, rows) => {
        const table = document.createElement('table');
        const head = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (const header of headers || []) {
          const cell = document.createElement('th');
          appendInline(cell, header);
          headerRow.append(cell);
        }
        head.append(headerRow);
        table.append(head);
        const body = document.createElement('tbody');
        for (const row of rows || []) {
          const rowElement = document.createElement('tr');
          for (const value of row || []) {
            const cell = document.createElement('td');
            appendInline(cell, value?.file?.link || value?.file?.name || value);
            rowElement.append(cell);
          }
          body.append(rowElement);
        }
        table.append(body);
        root.append(table);
        sendHeight();
      },
    };

    function sendHeight() {
      requestAnimationFrame(() => send({ type: 'height', height: Math.min(520, Math.max(100, document.body.scrollHeight + 16)) }));
    }

    const showError = error => {
      status?.remove();
      root.className = 'error';
      root.textContent = 'Ошибка DataviewJS: ' + (error?.message || String(error));
      sendHeight();
    };

    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const execute = new AsyncFunction('dv', ${serializeForScript(`"use strict";\n${code}`)});
      Promise.resolve(execute(dv)).then(() => {
        status?.remove();
        if (!root.childNodes.length) root.textContent = 'DataviewJS выполнен без вывода.';
        sendHeight();
      }).catch(showError);
    }
    catch (error) {
      showError(error);
    }
  })();`

  const csp = 'default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'; font-src \'none\'; frame-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\''

  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    :root{color-scheme:light dark;font:14px/1.5 system-ui,sans-serif;color:#292524;background:transparent}
    @media(prefers-color-scheme:dark){:root{color:#e7e5e4}}
    a.dataview-link{color:var(--dataview-link-color,#e16032);text-decoration:underline;text-underline-offset:3px;transition:opacity .15s ease}
    a.dataview-link:hover{opacity:.8}
    body{margin:0;padding:8px;overflow-wrap:anywhere}
    #output>*:first-child{margin-top:0}
    p{margin:0 0 10px}
    h1,h2,h3,h4,h5,h6{margin:12px 0 6px;line-height:1.3}
    progress{display:block;width:100%;height:10px;margin:8px 0 12px;accent-color:#ed704f}
    .task-list{list-style:none;padding:0;margin:6px 0 12px}
    .task-list li{margin:5px 0}
    .task-row{display:flex;align-items:flex-start;gap:8px}
    .task-list-nested{margin:4px 0 4px 22px}
    .task-list input{margin:4px 0 0;flex:none}
    table{border-collapse:collapse;width:100%;margin:8px 0}
    th,td{border:1px solid #8885;padding:5px 8px;text-align:left}
    .error{color:#b42318;background:#fee4e2;padding:8px;border-radius:6px}
  </style></head><body><div id="status">Запуск DataviewJS…</div><div id="output"></div><script>${script}</script></body></html>`
}

export function createDataviewJsNodeView(node: ProseMirrorNode, options: DataviewJsRendererOptions): NodeView {
  const dom = document.createElement('div')
  dom.className = 'milkdown-dataviewjs-block'

  const details = document.createElement('details')
  details.className = 'dataviewjs-source'
  const summary = document.createElement('summary')
  summary.textContent = 'DataviewJS · исходный код'
  details.append(summary)

  const pre = document.createElement('pre')
  const contentDOM = document.createElement('code')
  pre.append(contentDOM)
  details.append(pre)
  dom.append(details)

  const frame = document.createElement('iframe')
  frame.className = 'dataviewjs-output'
  frame.title = 'Результат DataviewJS'
  frame.setAttribute('sandbox', 'allow-scripts')
  frame.height = '140'
  dom.append(frame)

  let token = crypto.randomUUID()
  let currentCode = node.textContent

  const render = () => {
    const pages = buildPages(options.getNotes())
    const linkColor = getComputedStyle(document.documentElement).getPropertyValue('--fg-accent-color').trim() || '#e16032'
    token = crypto.randomUUID()
    frame.srcdoc = createSandboxDocument(
      currentCode,
      pages,
      options.currentNoteId,
      token,
      options.readonly(),
      linkColor,
    )
  }

  const handleMessage = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || !event.data || event.data.channel !== MESSAGE_CHANNEL || event.data.token !== token)
      return

    if (event.data.type === 'height') {
      const height = Number(event.data.height)

      if (Number.isFinite(height))
        frame.height = String(Math.min(520, Math.max(100, height)))
    }
    else if (event.data.type === 'toggle-task' && typeof event.data.noteId === 'string' && Number.isInteger(event.data.lineIndex)) {
      options.toggleTask({ noteId: event.data.noteId, lineIndex: event.data.lineIndex })
    }
  }

  const handleRefresh = () => render()
  window.addEventListener('message', handleMessage)
  dom.addEventListener('dataviewjs-refresh', handleRefresh)
  render()

  return {
    dom,
    contentDOM,
    update: (updatedNode) => {
      if (updatedNode.type.name !== 'code_block' || String(updatedNode.attrs.language || '').toLowerCase() !== 'dataviewjs')
        return false

      if (updatedNode.textContent !== currentCode) {
        currentCode = updatedNode.textContent
        render()
      }

      return true
    },
    ignoreMutation: mutation => mutation.target !== contentDOM && !contentDOM.contains(mutation.target),
    destroy: () => {
      window.removeEventListener('message', handleMessage)
      dom.removeEventListener('dataviewjs-refresh', handleRefresh)
    },
  }
}
