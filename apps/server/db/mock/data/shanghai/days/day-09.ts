import { DAY_IDS, getRoutePath, TRIP_ID } from '../constants'

export const MOCK_DAY_09 = {
  id: DAY_IDS.DAY_09,
  tripId: TRIP_ID,
  date: new Date('2025-05-18'),
  title: 'Культурный шок',
  description: 'День отдыха и культурных развлечений. После свободного времени днем, вечер будет посвящен уникальному театрализованному представлению с ужином, а после — исследованию ночной жизни Шанхая в одном из популярных баров или клубов.',
  activities: [
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_09, startTime: '10:00', endTime: '16:00', title: 'Свободное время', tag: 'relax' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Время для отдыха или самостоятельных прогулок.' }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_09, startTime: '16:00', endTime: '20:00', title: 'Представление в XUYAN Shanghai Signature Store', tag: 'attraction' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Погружение в китайскую культуру через театральное представление **(XUYAN)**, совмещенное с ужином и напитками. \n\n*Цена:* ~400 CNY. [Забронировать на Trip.com](https://us.trip.com/travel-guide/attraction/shanghai/xuyan-145736045/?locale=en-XX&curr=CNY)' }, { id: crypto.randomUUID(), type: 'gallery', imageUrls: [getRoutePath('20250311220840.png')] }] },
    { id: crypto.randomUUID(), dayId: DAY_IDS.DAY_09, startTime: '20:00', endTime: '23:00', title: 'Посещение бара / клуба', tag: 'relax' as const, sections: [{ id: crypto.randomUUID(), type: 'description', text: 'Знакомство с ночной жизнью Шанхая. \n\n| Название | Примечания |\n| :--- | :--- |\n| **Dada** | Классика, недорогие напитки. |\n| **Celia by Pulse** | Техно и хаус до утра. |\n| **Bar Rogue** | Популярный клуб на набережной. |\n| **M1NT** | Премиум-клуб с панорамным видом и аквариумом с акулами. |\n\nБольше вариантов: [smartshanghai](https://www.smartshanghai.com/)' }] },
  ],
}
