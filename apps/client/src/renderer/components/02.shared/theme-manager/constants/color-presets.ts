import type { ColorPalette } from '~/shared/store/theme.store'

export interface ThemePreset {
  name: string
  palette: ColorPalette
}

export const themePresets: ThemePreset[] = [
  {
    name: 'Светлая (Стандарт)',
    palette: {
      'bg-primary-color': '#eeeeee',
      'bg-secondary-color': '#e8eaeb',
      'bg-tertiary-color': '#dce0e4',
      'bg-header-color': '220, 223, 225',
      'bg-disabled-color': '#e7e9ed',
      'bg-inverted-color': '#22263b',
      'bg-accent-overlay-color': '#818bb5',
      'bg-accent-color': '#d7e0f3',
      'bg-pressed-color': '#22263b0d',
      'bg-overlay-primary-color': '#454a6115',
      'bg-overlay-secondary-color': '#94a1abdc',
      'bg-action-hover-color': '#828dca',
      'bg-hover-color': '#d0d1d3',
      'bg-focus-color': '#d7e0f3',
      'bg-highlight-color': '#e3e2ff',
      'bg-success-color': '#d0e6d2',
      'bg-error-color': '#ebd5d9',
      'bg-warning-color': '#fcefdc',
      'bg-info-color': '#d4e8f7',
      'fg-primary-color': '#22263b',
      'fg-secondary-color': '#22263bcc',
      'fg-tertiary-color': '#22263b99',
      'fg-muted-color': '#22263b66',
      'fg-accent-color': '#344079',
      'fg-action-color': '#424c86',
      'fg-inverted-color': '#ffffff',
      'fg-disabled-color': '#22263b4d',
      'fg-pressed-color': '#22263b',
      'fg-highlight-color': '#8a89dd',
      'fg-success-color': '#1e6627',
      'fg-error-color': '#8c2b3d',
      'fg-warning-color': '#8a5a1b',
      'fg-info-color': '#2a5a7f',
      'border-primary-color': '#abacb3',
      'border-secondary-color': '#d9dadc',
      'border-accent-color': '#bbcef8',
      'border-disabled-color': '#d9dadc',
      'border-button-secondary-color': '#c9cbd7',
      'border-focus-color': '#344079',
      'border-pressed-color': '#344079',
      'border-success-color': '#5b9d63',
      'border-error-color': '#c58c99',
      'border-warning-color': '#e6c58d',
      'border-info-color': '#89b9d9',
    },
  },
  {
    name: 'Тёмная (Стандарт)',
    palette: {
      'bg-primary-color': '#1e1f20',
      'bg-secondary-color': '#121314',
      'bg-tertiary-color': '#151617',
      'bg-header-color': '18, 19, 20',
      'bg-disabled-color': '#353535',
      'bg-inverted-color': '#e4e4e4',
      'bg-accent-overlay-color': '#441717',
      'bg-accent-color': '#181717',
      'bg-pressed-color': '#ffffff1a',
      'bg-overlay-primary-color': '#131010',
      'bg-overlay-secondary-color': '#ffffff1a',
      'bg-action-hover-color': '#e18a4c',
      'bg-hover-color': '#ebb89340',
      'bg-focus-color': '#ffffff1a',
      'bg-highlight-color': '#5a482c',
      'bg-success-color': '#2c492f',
      'bg-error-color': '#6d3b46',
      'bg-warning-color': '#5a482c',
      'bg-info-color': '#2a4a6e',
      'fg-primary-color': '#e4e4e4',
      'fg-secondary-color': '#e4e4e4cc',
      'fg-tertiary-color': '#e4e4e499',
      'fg-muted-color': '#e4e4e466',
      'fg-accent-color': '#ff8856',
      'fg-action-color': '#e18a4c',
      'fg-inverted-color': '#1e1f20',
      'fg-disabled-color': '#e4e4e44d',
      'fg-pressed-color': '#e4e4e4',
      'fg-highlight-color': '#dab180',
      'fg-success-color': '#67d174',
      'fg-error-color': '#ff879d',
      'fg-warning-color': '#f5b971',
      'fg-info-color': '#79b3f7',
      'border-primary-color': '#353535',
      'border-secondary-color': '#222324',
      'border-accent-color': '#632732',
      'border-disabled-color': '#222324',
      'border-button-secondary-color': '#623f30',
      'border-focus-color': '#ff8856',
      'border-pressed-color': '#ff8856',
      'border-success-color': '#43884d',
      'border-error-color': '#8c3b4d',
      'border-warning-color': '#b5853b',
      'border-info-color': '#4a7fa9',
    },
  },
  {
    name: 'Ретро-терминал',
    palette: {
      // BG - теплый, почти черный цвет старого пластика
      'bg-primary-color': '#1e1c1b',
      'bg-secondary-color': '#2a2725',
      'bg-tertiary-color': '#33302e',
      'bg-header-color': '42, 39, 37',
      'bg-disabled-color': '#2a2725',
      'bg-inverted-color': '#ffb86c',
      'bg-accent-overlay-color': '#f0717833',
      'bg-accent-color': '#3f2d22',
      'bg-pressed-color': '#ffb86c0d',
      'bg-overlay-primary-color': '#bca38336',
      'bg-overlay-secondary-color': '#4a4540dc',
      'bg-action-hover-color': '#f07178',
      'bg-hover-color': '#33302e',
      'bg-focus-color': '#3f2d22',
      'bg-highlight-color': '#5a4d3b',

      // BG STATUS - имитация изменения цвета люминофора
      'bg-success-color': '#3a4431',
      'bg-error-color': '#4f3032',
      'bg-warning-color': '#5a4d3b',
      'bg-info-color': '#3d4449',

      // FG - монохромный янтарный цвет текста
      'fg-primary-color': '#ffb86c',
      'fg-secondary-color': '#d89c5c',
      'fg-tertiary-color': '#bca383',
      'fg-muted-color': '#ffb86c66',
      'fg-accent-color': '#f07178',
      'fg-action-color': '#f07178',
      'fg-inverted-color': '#1e1c1b',
      'fg-disabled-color': '#ffb86c4d',
      'fg-pressed-color': '#1e1c1b',
      'fg-highlight-color': '#f1fa8c',

      // FG STATUS - разные оттенки для статусов, но в общей стилистике
      'fg-success-color': '#a1c181',
      'fg-error-color': '#f07178',
      'fg-warning-color': '#ffb86c',
      'fg-info-color': '#8abeb7',

      // Border - едва видимые границы, подчеркивающие минимализм
      'border-primary-color': '#4a4540',
      'border-secondary-color': '#33302e',
      'border-accent-color': '#f07178',
      'border-disabled-color': '#33302e',
      'border-button-secondary-color': '#4b3b2b', // Рассчитано из #ffb86c33
      'border-focus-color': '#f07178',
      'border-pressed-color': '#f07178',

      // BORDER STATUS
      'border-success-color': '#a1c181',
      'border-error-color': '#f07178',
      'border-warning-color': '#ffb86c',
      'border-info-color': '#8abeb7',
    },
  },

  {
    name: 'Нордический Бриз',
    palette: {
      // BG
      'bg-primary-color': '#eceff4',
      'bg-secondary-color': '#e5e9f0',
      'bg-tertiary-color': '#d8dee9',
      'bg-header-color': '229, 233, 240',
      'bg-disabled-color': '#e5e9f0',
      'bg-inverted-color': '#2e3440',
      'bg-accent-overlay-color': '#5e81ac4d',
      'bg-accent-color': '#dce5f0',
      'bg-pressed-color': '#2e34400d',
      'bg-overlay-primary-color': '#4c566a36',
      'bg-overlay-secondary-color': '#4c566adc',
      'bg-action-hover-color': '#81a1c1',
      'bg-hover-color': '#d8dee9',
      'bg-focus-color': '#dce5f0',
      'bg-highlight-color': '#f4efe2',

      // BG STATUS
      'bg-success-color': '#e6f0df',
      'bg-error-color': '#f2e0e2',
      'bg-warning-color': '#f5e8e3',
      'bg-info-color': '#e4f2f5',

      // FG
      'fg-primary-color': '#2e3440',
      'fg-secondary-color': '#4c566a',
      'fg-tertiary-color': '#4c566a',
      'fg-muted-color': '#2e344066',
      'fg-accent-color': '#5e81ac',
      'fg-action-color': '#5e81ac',
      'fg-inverted-color': '#eceff4',
      'fg-disabled-color': '#2e34404d',
      'fg-pressed-color': '#2e3440',
      'fg-highlight-color': '#bf9d6f',

      // FG STATUS
      'fg-success-color': '#a3be8c',
      'fg-error-color': '#bf616a',
      'fg-warning-color': '#d08770',
      'fg-info-color': '#88c0d0',

      // Border
      'border-primary-color': '#d8dee9',
      'border-secondary-color': '#e5e9f0',
      'border-accent-color': '#81a1c1',
      'border-disabled-color': '#e5e9f0',
      'border-button-secondary-color': '#cfd9e5', // Рассчитано из #5e81ac33
      'border-focus-color': '#5e81ac',
      'border-pressed-color': '#5e81ac',

      // BORDER STATUS
      'border-success-color': '#b3cc9f',
      'border-error-color': '#cc8088',
      'border-warning-color': '#d9a290',
      'border-info-color': '#a3d1de',
    },
  },
  {
    name: 'Солнечная Гавань',
    palette: {
      // BG
      'bg-primary-color': '#f1f0e9',
      'bg-secondary-color': '#eae8e0',
      'bg-tertiary-color': '#e6e4de',
      'bg-header-color': '234, 232, 224',
      'bg-disabled-color': '#f2f2f2',
      'bg-inverted-color': '#1b1b1f',
      'bg-accent-overlay-color': '#00b96b33',
      'bg-accent-color': '#d2e7dd',
      'bg-pressed-color': '#1b1b1f0d',
      'bg-overlay-primary-color': '#36363636',
      'bg-overlay-secondary-color': '#aeaeb2dc',
      'bg-action-hover-color': '#00b96b99',
      'bg-hover-color': '#eeeeee',
      'bg-focus-color': '#d2e7dd',
      'bg-highlight-color': '#fcf8e3',

      // BG STATUS
      'bg-success-color': '#d9f1e4',
      'bg-error-color': '#fde5e3',
      'bg-warning-color': '#fff4d9',
      'bg-info-color': '#d9e8ff',

      // FG
      'fg-primary-color': '#1b1b1f',
      'fg-secondary-color': '#1b1b1f99',
      'fg-tertiary-color': '#1b1b1f61',
      'fg-muted-color': '#1b1b1f40',
      'fg-accent-color': '#1c6b48',
      'fg-action-color': '#1c6b48',
      'fg-inverted-color': '#ffffff',
      'fg-disabled-color': '#1b1b1f4d',
      'fg-pressed-color': '#1b1b1f',
      'fg-highlight-color': '#9c7a2e',

      // FG STATUS
      'fg-success-color': '#1c6b48',
      'fg-error-color': '#f44336',
      'fg-warning-color': '#b8860b',
      'fg-info-color': '#1677ff',

      // Border
      'border-primary-color': '#cbcac4', // Рассчитано из #00000028
      'border-secondary-color': '#d2d2cb', // Рассчитано из #00000020
      'border-accent-color': '#86bda5',
      'border-disabled-color': '#d2d2cb', // Рассчитано из #00000020
      'border-button-secondary-color': '#c0e5cf', // Рассчитано из #00b96b33
      'border-focus-color': '#1c6b48',
      'border-pressed-color': '#1c6b48',

      // BORDER STATUS
      'border-success-color': '#5cb85c',
      'border-error-color': '#f88a82',
      'border-warning-color': '#ffd580',
      'border-info-color': '#8abfff',
    },
  },
  {
    name: 'Полуночный Неон',
    palette: {
      // BG
      'bg-primary-color': '#282a36',
      'bg-secondary-color': '#21222c',
      'bg-tertiary-color': '#44475a',
      'bg-header-color': '33, 34, 44',
      'bg-disabled-color': '#21222c',
      'bg-inverted-color': '#f8f8f2',
      'bg-accent-overlay-color': '#ff79c64d',
      'bg-accent-color': '#44324f',
      'bg-pressed-color': '#f8f8f20d',
      'bg-overlay-primary-color': '#bd93f936',
      'bg-overlay-secondary-color': '#6272a4dc',
      'bg-action-hover-color': '#ff92d4',
      'bg-hover-color': '#44475a',
      'bg-focus-color': '#44324f',
      'bg-highlight-color': '#504e3b',

      // BG STATUS
      'bg-success-color': '#334e3d',
      'bg-error-color': '#4f3535',
      'bg-warning-color': '#504e3b',
      'bg-info-color': '#3c4b50',

      // FG
      'fg-primary-color': '#f8f8f2',
      'fg-secondary-color': '#bd93f9',
      'fg-tertiary-color': '#6272a4',
      'fg-muted-color': '#f8f8f266',
      'fg-accent-color': '#ff79c6',
      'fg-action-color': '#ff79c6',
      'fg-inverted-color': '#282a36',
      'fg-disabled-color': '#f8f8f24d',
      'fg-pressed-color': '#f8f8f2',
      'fg-highlight-color': '#f1fa8c',

      // FG STATUS
      'fg-success-color': '#50fa7b',
      'fg-error-color': '#ff5555',
      'fg-warning-color': '#f1fa8c',
      'fg-info-color': '#8be9fd',

      // Border
      'border-primary-color': '#44475a',
      'border-secondary-color': '#191a21',
      'border-accent-color': '#ff92d4',
      'border-disabled-color': '#191a21',
      'border-button-secondary-color': '#533952', // Рассчитано из #ff79c633
      'border-focus-color': '#ff79c6',
      'border-pressed-color': '#ff79c6',

      // BORDER STATUS
      'border-success-color': '#50fa7b',
      'border-error-color': '#ff5555',
      'border-warning-color': '#f1fa8c',
      'border-info-color': '#8be9fd',
    },
  },
  {
    name: 'Лесной Сумрак',
    palette: {
      // BG - глубокие, темные, приглушенные зеленые и коричневые тона
      'bg-primary-color': '#1a241f',
      'bg-secondary-color': '#212d27',
      'bg-tertiary-color': '#334139',
      'bg-header-color': '33, 45, 39',
      'bg-disabled-color': '#212d27',
      'bg-inverted-color': '#e0e6e2',
      'bg-accent-overlay-color': '#d4ac5b26',
      'bg-accent-color': '#3a3f33',
      'bg-pressed-color': '#e0e6e20d',
      'bg-overlay-primary-color': '#8a9a8f36',
      'bg-overlay-secondary-color': '#4e5a54dc',
      'bg-action-hover-color': '#e8c47f',
      'bg-hover-color': '#334139',
      'bg-focus-color': '#3a3f33',
      'bg-highlight-color': '#423b27',

      // BG STATUS - цвета лесных ягод и мха
      'bg-success-color': '#2b4030',
      'bg-error-color': '#472f33',
      'bg-warning-color': '#423b27',
      'bg-info-color': '#2e4149',

      // FG - мягкие, светло-серые и золотистые оттенки, как лунный свет
      'fg-primary-color': '#e0e6e2',
      'fg-secondary-color': '#8a9a8f',
      'fg-tertiary-color': '#6c7a72',
      'fg-muted-color': '#e0e6e266',
      'fg-accent-color': '#d4ac5b',
      'fg-action-color': '#d4ac5b',
      'fg-inverted-color': '#1a241f',
      'fg-disabled-color': '#e0e6e24d',
      'fg-pressed-color': '#e0e6e2',
      'fg-highlight-color': '#f3d999',

      // FG STATUS
      'fg-success-color': '#6aab7c',
      'fg-error-color': '#c95b6a',
      'fg-warning-color': '#d4ac5b',
      'fg-info-color': '#6f9fb1',

      // Border - едва заметные, органичные
      'border-primary-color': '#334139',
      'border-secondary-color': '#212d27',
      'border-accent-color': '#e8c47f',
      'border-disabled-color': '#212d27',
      'border-button-secondary-color': '#3f3f2b', // Рассчитано из #d4ac5b33
      'border-focus-color': '#d4ac5b',
      'border-pressed-color': '#d4ac5b',

      // BORDER STATUS
      'border-success-color': '#6aab7c',
      'border-error-color': '#c95b6a',
      'border-warning-color': '#d4ac5b',
      'border-info-color': '#6f9fb1',
    },
  },
  {
    name: 'Yeap',
    palette: {
      // BG
      'bg-primary-color': '#faf4f2',
      'bg-secondary-color': '#f2edeb',
      'bg-tertiary-color': '#e0dad9',
      'bg-header-color': '242, 237, 235',
      'bg-disabled-color': '#f2edeb',
      'bg-inverted-color': '#29242a',
      'bg-accent-overlay-color': '#e160324d',
      'bg-accent-color': '#fce9e4',
      'bg-pressed-color': '#29242a0d',
      'bg-overlay-primary-color': '#706b6e36',
      'bg-overlay-secondary-color': '#a59fa0dc',
      'bg-action-hover-color': '#f37a51',
      'bg-hover-color': '#ede7e5bf',
      'bg-focus-color': '#fce9e4',
      'bg-highlight-color': '#fdf5d7',

      // BG STATUS
      'bg-success-color': '#d4e6d6',
      'bg-error-color': '#f3d9e0',
      'bg-warning-color': '#fce9e4',
      'bg-info-color': '#fdecd7',

      // FG
      'fg-primary-color': '#29242a',
      'fg-secondary-color': '#706b6e',
      'fg-tertiary-color': '#a59fa0',
      'fg-muted-color': '#29242a66',
      'fg-accent-color': '#e16032',
      'fg-action-color': '#e16032',
      'fg-inverted-color': '#faf4f2',
      'fg-disabled-color': '#29242a4d',
      'fg-pressed-color': '#29242a',
      'fg-highlight-color': '#d99f47',

      // FG STATUS
      'fg-success-color': '#269d69',
      'fg-error-color': '#e14775',
      'fg-warning-color': '#e16032',
      'fg-info-color': '#cc7a0a',

      // Border
      'border-primary-color': '#d2cdcb',
      'border-secondary-color': '#e0dad9',
      'border-accent-color': '#f37a51',
      'border-disabled-color': '#e0dad9',
      'border-button-secondary-color': '#f5d6cb', // Рассчитано из #e1603233
      'border-focus-color': '#e16032',
      'border-pressed-color': '#e16032',

      // BORDER STATUS
      'border-success-color': '#5bbd8b',
      'border-error-color': '#e87899',
      'border-warning-color': '#f37a51',
      'border-info-color': '#d99f47',
    },
  },
  {
    name: 'Цветение Сакуры',
    palette: {
      // BG - очень светлые, почти белые тона с легким розовым оттенком, как лепестки
      'bg-primary-color': '#fdf8f8',
      'bg-secondary-color': '#f9f4f4',
      'bg-tertiary-color': '#f2ebeb',
      'bg-header-color': '249, 244, 244',
      'bg-disabled-color': '#f9f4f4',
      'bg-inverted-color': '#4a4141',
      'bg-accent-overlay-color': '#e68c9c33',
      'bg-accent-color': '#fae9eb',
      'bg-pressed-color': '#4a41410d',
      'bg-overlay-primary-color': '#8e818136',
      'bg-overlay-secondary-color': '#b4a5a5dc',
      'bg-action-hover-color': '#eb9fb0',
      'bg-hover-color': '#f2ebeb',
      'bg-focus-color': '#fae9eb',
      'bg-highlight-color': '#f5f3da',

      // BG STATUS - пастельные, природные цвета
      'bg-success-color': '#e7f0e9',
      'bg-error-color': '#f8dfe2',
      'bg-warning-color': '#f6f1e3',
      'bg-info-color': '#e8eaf2',

      // FG - тёплые, тёмно-серые и коричневатые тона, как кора дерева
      'fg-primary-color': '#4a4141',
      'fg-secondary-color': '#8e8181',
      'fg-tertiary-color': '#b4a5a5',
      'fg-muted-color': '#4a414166',
      'fg-accent-color': '#e68c9c',
      'fg-action-color': '#d96d7f',
      'fg-inverted-color': '#fdf8f8',
      'fg-disabled-color': '#4a41414d',
      'fg-pressed-color': '#4a4141',
      'fg-highlight-color': '#c4b574',

      // FG STATUS
      'fg-success-color': '#88b898',
      'fg-error-color': '#d96d7f',
      'fg-warning-color': '#d1aa75',
      'fg-info-color': '#8b9dc1',

      // Border - мягкие и тонкие
      'border-primary-color': '#e4dcdc',
      'border-secondary-color': '#f2ebeb',
      'border-accent-color': '#eb9fb0',
      'border-disabled-color': '#f2ebeb',
      'border-button-secondary-color': '#f6d7dc', // Рассчитано из #e68c9c4d
      'border-focus-color': '#e68c9c',
      'border-pressed-color': '#d96d7f',

      // BORDER STATUS
      'border-success-color': '#a3c9b0',
      'border-error-color': '#e3a2ac',
      'border-warning-color': '#ddc49e',
      'border-info-color': '#aeb9d4',
    },
  },
  {
    name: 'Космическая Бездна',
    palette: {
      // BG - глубокие, тёмно-синие и фиолетовые оттенки космоса
      'bg-primary-color': '#0d1117',
      'bg-secondary-color': '#161b22',
      'bg-tertiary-color': '#21262d',
      'bg-header-color': '22, 27, 34',
      'bg-disabled-color': '#161b22',
      'bg-inverted-color': '#c9d1d9',
      'bg-accent-overlay-color': '#c975de33',
      'bg-accent-color': '#30213d',
      'bg-pressed-color': '#c9d1d90d',
      'bg-overlay-primary-color': '#8b949e36',
      'bg-overlay-secondary-color': '#586069dc',
      'bg-action-hover-color': '#db90f5',
      'bg-hover-color': '#21262d',
      'bg-focus-color': '#30213d',
      'bg-highlight-color': '#3e3420',

      // BG STATUS - цвета туманностей и далёких звёзд
      'bg-success-color': '#1c3421',
      'bg-error-color': '#412224',
      'bg-warning-color': '#3e3420',
      'bg-info-color': '#223b4e',

      // FG - светлые, холодные оттенки для текста, как свет звёзд
      'fg-primary-color': '#c9d1d9',
      'fg-secondary-color': '#8b949e',
      'fg-tertiary-color': '#586069',
      'fg-muted-color': '#c9d1d966',
      'fg-accent-color': '#c975de',
      'fg-action-color': '#c975de',
      'fg-inverted-color': '#0d1117',
      'fg-disabled-color': '#c9d1d94d',
      'fg-pressed-color': '#c9d1d9',
      'fg-highlight-color': '#e3b341',

      // FG STATUS
      'fg-success-color': '#56d364',
      'fg-error-color': '#f85149',
      'fg-warning-color': '#e3b341',
      'fg-info-color': '#76e3ea',

      // Border - четкие, но не отвлекающие
      'border-primary-color': '#30363d',
      'border-secondary-color': '#21262d',
      'border-accent-color': '#db90f5',
      'border-disabled-color': '#21262d',
      'border-button-secondary-color': '#32253e', // Рассчитано из #c975de33
      'border-focus-color': '#c975de',
      'border-pressed-color': '#c975de',

      // BORDER STATUS
      'border-success-color': '#56d364',
      'border-error-color': '#f85149',
      'border-warning-color': '#e3b341',
      'border-info-color': '#76e3ea',
    },
  },
  {
    name: 'Пустынный Закат',
    palette: {
      // BG - тёплые, землистые оттенки песка и скал на закате
      'bg-primary-color': '#f5eee6',
      'bg-secondary-color': '#eadfd3',
      'bg-tertiary-color': '#dccbbc',
      'bg-header-color': '234, 223, 211',
      'bg-disabled-color': '#eadfd3',
      'bg-inverted-color': '#4d3d33',
      'bg-accent-overlay-color': '#d96c4733',
      'bg-accent-color': '#f2e5de',
      'bg-pressed-color': '#4d3d330d',
      'bg-overlay-primary-color': '#8c7a6b36',
      'bg-overlay-secondary-color': '#a38f7edc',
      'bg-action-hover-color': '#e07f5f',
      'bg-hover-color': '#dccbbc',
      'bg-focus-color': '#f2e5de',
      'bg-highlight-color': '#fcf4d2',

      // BG STATUS - цвета выжженной земли и редких оазисов
      'bg-success-color': '#e4ebe4',
      'bg-error-color': '#f5e0e0',
      'bg-warning-color': '#faead9',
      'bg-info-color': '#dde8f0',

      // FG - глубокие, тёмно-коричневые и терракотовые цвета
      'fg-primary-color': '#4d3d33',
      'fg-secondary-color': '#8c7a6b',
      'fg-tertiary-color': '#a38f7e',
      'fg-muted-color': '#4d3d3366',
      'fg-accent-color': '#d96c47',
      'fg-action-color': '#bf5b3b',
      'fg-inverted-color': '#f5eee6',
      'fg-disabled-color': '#4d3d334d',
      'fg-pressed-color': '#4d3d33',
      'fg-highlight-color': '#b38b2a',

      // FG STATUS
      'fg-success-color': '#5a8b5a',
      'fg-error-color': '#c75e5e',
      'fg-warning-color': '#d96c47',
      'fg-info-color': '#6e8ca8',

      // Border - натуральные, как трещины в земле
      'border-primary-color': '#cbb6a3',
      'border-secondary-color': '#dccbbc',
      'border-accent-color': '#e07f5f',
      'border-disabled-color': '#dccbbc',
      'border-button-secondary-color': '#ecc7b6', // Рассчитано из #d96c474d
      'border-focus-color': '#d96c47',
      'border-pressed-color': '#bf5b3b',

      // BORDER STATUS
      'border-success-color': '#8cb88c',
      'border-error-color': '#d68989',
      'border-warning-color': '#e6a68f',
      'border-info-color': '#9cb4c9',
    },
  },
  {
    name: 'Глубоководная Экспедиция',
    palette: {
      // BG - тёмные, холодные сине-зелёные цвета океанских глубин
      'bg-primary-color': '#0f1f2a',
      'bg-secondary-color': '#162836',
      'bg-tertiary-color': '#213848',
      'bg-header-color': '22, 40, 54',
      'bg-disabled-color': '#162836',
      'bg-inverted-color': '#e1f3ff',
      'bg-accent-overlay-color': '#33e1c933',
      'bg-accent-color': '#1d394a',
      'bg-pressed-color': '#e1f3ff0d',
      'bg-overlay-primary-color': '#96b6cf36',
      'bg-overlay-secondary-color': '#4e6e87dc',
      'bg-action-hover-color': '#59ebd3',
      'bg-hover-color': '#213848',
      'bg-focus-color': '#1d394a',
      'bg-highlight-color': '#3a3e35',

      // BG STATUS - цвета биолюминесценции
      'bg-success-color': '#223d38',
      'bg-error-color': '#452b31',
      'bg-warning-color': '#45422b',
      'bg-info-color': '#243b52',

      // FG - светящиеся, яркие бирюзовые и голубые оттенки
      'fg-primary-color': '#e1f3ff',
      'fg-secondary-color': '#96b6cf',
      'fg-tertiary-color': '#6c8aa3',
      'fg-muted-color': '#e1f3ff66',
      'fg-accent-color': '#33e1c9',
      'fg-action-color': '#33e1c9',
      'fg-inverted-color': '#0f1f2a',
      'fg-disabled-color': '#e1f3ff4d',
      'fg-pressed-color': '#e1f3ff',
      'fg-highlight-color': '#d5e05a',

      // FG STATUS
      'fg-success-color': '#5ce09b',
      'fg-error-color': '#e36a7e',
      'fg-warning-color': '#f2da6c',
      'fg-info-color': '#5ca7e3',

      // Border - четкие, технологичные
      'border-primary-color': '#2f4b5f',
      'border-secondary-color': '#213848',
      'border-accent-color': '#59ebd3',
      'border-disabled-color': '#213848',
      'border-button-secondary-color': '#164549', // Рассчитано из #33e1c933
      'border-focus-color': '#33e1c9',
      'border-pressed-color': '#33e1c9',

      // BORDER STATUS
      'border-success-color': '#5ce09b',
      'border-error-color': '#e36a7e',
      'border-warning-color': '#f2da6c',
      'border-info-color': '#5ca7e3',
    },
  },
  {
    name: 'Пыльный Архив',
    palette: {
      // BG - тёплые, состаренные оттенки пергамента и старых книг
      'bg-primary-color': '#f3efe9',
      'bg-secondary-color': '#e8e2d9',
      'bg-tertiary-color': '#d9d1c7',
      'bg-header-color': '232, 226, 217',
      'bg-disabled-color': '#e8e2d9',
      'bg-inverted-color': '#4a443c',
      'bg-accent-overlay-color': '#4b826633',
      'bg-accent-color': '#e3eae6',
      'bg-pressed-color': '#4a443c0d',
      'bg-overlay-primary-color': '#8e867b36',
      'bg-overlay-secondary-color': '#a79c8edc',
      'bg-action-hover-color': '#5a9c7b',
      'bg-hover-color': '#d9d1c7',
      'bg-focus-color': '#e3eae6',
      'bg-highlight-color': '#f9f2d7',

      // BG STATUS - цвета выцветших чернил и старой бумаги
      'bg-success-color': '#e4eee6',
      'bg-error-color': '#f5e3e3',
      'bg-warning-color': '#fcf4dd',
      'bg-info-color': '#e0e7ee',

      // FG - тёмные, серо-коричневые тона, как старые чернила
      'fg-primary-color': '#4a443c',
      'fg-secondary-color': '#8e867b',
      'fg-tertiary-color': '#a79c8e',
      'fg-muted-color': '#4a443c66',
      'fg-accent-color': '#4b8266',
      'fg-action-color': '#4b8266',
      'fg-inverted-color': '#f3efe9',
      'fg-disabled-color': '#4a443c4d',
      'fg-pressed-color': '#4a443c',
      'fg-highlight-color': '#c2a14d',

      // FG STATUS
      'fg-success-color': '#4b8266',
      'fg-error-color': '#c46d6d',
      'fg-warning-color': '#b38f2b',
      'fg-info-color': '#617a94',

      // Border - едва заметные, элегантные
      'border-primary-color': '#c7c0b6',
      'border-secondary-color': '#d9d1c7',
      'border-accent-color': '#5a9c7b',
      'border-disabled-color': '#d9d1c7',
      'border-button-secondary-color': '#c0cec1',
      'border-focus-color': '#4b8266',
      'border-pressed-color': '#4b8266',

      // BORDER STATUS
      'border-success-color': '#7dae94',
      'border-error-color': '#d49898',
      'border-warning-color': '#dac288',
      'border-info-color': '#95a9bd',
    },
  },
  {
    name: 'Киберпанк Рассвет',
    palette: {
      // BG - тёмный, почти чёрный фон с фиолетово-синим подтоном ночного города
      'bg-primary-color': '#110f1b',
      'bg-secondary-color': '#1a1824',
      'bg-tertiary-color': '#2a2736',
      'bg-header-color': '26, 24, 36',
      'bg-disabled-color': '#1a1824',
      'bg-inverted-color': '#ebe8ff',
      'bg-accent-overlay-color': '#e838ff33',
      'bg-accent-color': '#362340',
      'bg-pressed-color': '#ebe8ff0d',
      'bg-overlay-primary-color': '#a59ac736',
      'bg-overlay-secondary-color': '#6c628e',
      'bg-action-hover-color': '#f062ff',
      'bg-hover-color': '#2a2736',
      'bg-focus-color': '#362340',
      'bg-highlight-color': '#4d4b29',

      // BG STATUS - неоновое свечение в темноте
      'bg-success-color': '#1d3e38',
      'bg-error-color': '#472338',
      'bg-warning-color': '#4d4b29',
      'bg-info-color': '#1f3c54',

      // FG - холодные, светлые оттенки для контраста на тёмном фоне
      'fg-primary-color': '#ebe8ff',
      'fg-secondary-color': '#a59ac7',
      'fg-tertiary-color': '#6c628e',
      'fg-muted-color': '#ebe8ff66',
      'fg-accent-color': '#e838ff',
      'fg-action-color': '#e838ff',
      'fg-inverted-color': '#110f1b',
      'fg-disabled-color': '#ebe8ff4d',
      'fg-pressed-color': '#ebe8ff',
      'fg-highlight-color': '#efff5b',

      // FG STATUS
      'fg-success-color': '#36ffc5',
      'fg-error-color': '#ff4a9f',
      'fg-warning-color': '#efff5b',
      'fg-info-color': '#4dcfff',

      // Border - резкие, очерченные линии
      'border-primary-color': '#3c384f',
      'border-secondary-color': '#2a2736',
      'border-accent-color': '#f062ff',
      'border-disabled-color': '#2a2736',
      'border-button-secondary-color': '#3c1748',
      'border-focus-color': '#e838ff',
      'border-pressed-color': '#e838ff',

      // BORDER STATUS
      'border-success-color': '#36ffc5',
      'border-error-color': '#ff4a9f',
      'border-warning-color': '#efff5b',
      'border-info-color': '#4dcfff',
    },
  },
]
