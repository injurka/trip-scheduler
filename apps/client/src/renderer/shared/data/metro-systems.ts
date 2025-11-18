export interface Station {
  id: string
  name: string
}

export interface MetroLine {
  id: string
  name: string
  color: string
  stations: Station[]
}

export interface CityMetroSystem {
  key: string
  name: string
  lines: MetroLine[]
}

export const METRO_SYSTEMS: Record<string, CityMetroSystem> = {
  moscow: {
    key: 'moscow',
    name: 'Москва',
    lines: [
      {
        id: 'moscow-1',
        name: 'Сокольническая',
        color: '#EF161E',
        stations: [
          { id: 'sok-1', name: 'Бульвар Рокоссовского' },
          { id: 'sok-2', name: 'Черкизовская' },
          { id: 'sok-3', name: 'Преображенская площадь' },
          { id: 'sok-4', name: 'Сокольники' },
        ],
      },
      {
        id: 'moscow-2',
        name: 'Замоскворецкая',
        color: '#009A3E',
        stations: [
          { id: 'zam-1', name: 'Ховрино' },
          { id: 'zam-2', name: 'Беломорская' },
          { id: 'zam-3', name: 'Речной вокзал' },
          { id: 'zam-4', name: 'Водный стадион' },
        ],
      },
      {
        id: 'moscow-5',
        name: 'Кольцевая',
        color: '#8D5B2D',
        stations: [
          { id: 'kol-1', name: 'Парк культуры' },
          { id: 'kol-2', name: 'Октябрьская' },
          { id: 'kol-3', name: 'Добрынинская' },
          { id: 'kol-4', name: 'Павелецкая' },
        ],
      },
    ],
  },
  kazan: {
    key: 'kazan',
    name: 'Казань',
    lines: [
      {
        id: 'kazan-1',
        name: 'Центральная',
        color: '#D42128',
        stations: [
          { id: 'kaz-1', name: 'Авиастроительная' },
          { id: 'kaz-2', name: 'Северный вокзал' },
          { id: 'kaz-3', name: 'Яшьлек' },
          { id: 'kaz-4', name: 'Козья слобода' },
        ],
      },
    ],
  },
}
