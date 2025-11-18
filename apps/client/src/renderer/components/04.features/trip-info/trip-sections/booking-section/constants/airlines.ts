import type { KitDropdownItem } from '~/components/01.kit/kit-dropdown'

/**
 * Опция для списка авиакомпаний.
 * value: IATA-код
 * label: Название авиакомпании
 * name: Полное название для автозаполнения
 */
export interface AirlineOption extends KitDropdownItem<string> {
  name: string
}

export const AIRLINES_LIST: AirlineOption[] = [
  { value: 'SU', label: 'Аэрофлот (SU)', name: 'Аэрофлот' },
  { value: 'S7', label: 'S7 Airlines (S7)', name: 'S7 Airlines' },
  { value: 'U6', label: 'Уральские авиалинии (U6)', name: 'Уральские авиалинии' },
  { value: 'DP', label: 'Победа (DP)', name: 'Победа' },
  { value: 'UT', label: 'Utair (UT)', name: 'Utair' },
  { value: 'FV', label: 'Россия (FV)', name: 'Россия' },
  { value: 'TK', label: 'Turkish Airlines (TK)', name: 'Turkish Airlines' },
  { value: 'EK', label: 'Emirates (EK)', name: 'Emirates' },
  { value: 'QR', label: 'Qatar Airways (QR)', name: 'Qatar Airways' },
  { value: 'LH', label: 'Lufthansa (LH)', name: 'Lufthansa' },
  { value: 'AF', label: 'Air France (AF)', name: 'Air France' },
  { value: 'KL', label: 'KLM (KL)', name: 'KLM' },
  { value: 'BA', label: 'British Airways (BA)', name: 'British Airways' },
  { value: 'AZ', label: 'ITA Airways (AZ)', name: 'ITA Airways' },
  { value: 'LX', label: 'SWISS (LX)', name: 'SWISS' },
  { value: 'AY', label: 'Finnair (AY)', name: 'Finnair' },
  { value: 'PC', label: 'Pegasus Airlines (PC)', name: 'Pegasus Airlines' },
  { value: 'CA', label: 'Air China (CA)', name: 'Air China' },
  { value: 'CZ', label: 'China Southern Airlines (CZ)', name: 'China Southern Airlines' },
  { value: 'SQ', label: 'Singapore Airlines (SQ)', name: 'Singapore Airlines' },
  { value: 'NH', label: 'All Nippon Airways (NH)', name: 'All Nippon Airways' },
  { value: 'KE', label: 'Korean Air (KE)', name: 'Korean Air' },
  { value: 'DL', label: 'Delta Air Lines (DL)', name: 'Delta Air Lines' },
  { value: 'AA', label: 'American Airlines (AA)', name: 'American Airlines' },
  { value: 'UA', label: 'United Airlines (UA)', name: 'United Airlines' },
  { value: 'AC', label: 'Air Canada (AC)', name: 'Air Canada' },
  { value: 'ET', label: 'Ethiopian Airlines (ET)', name: 'Ethiopian Airlines' },
  { value: 'MS', label: 'EgyptAir (MS)', name: 'EgyptAir' },
  { value: 'LY', label: 'El Al (LY)', name: 'El Al' },
  { value: 'HY', label: 'Uzbekistan Airways (HY)', name: 'Uzbekistan Airways' },
]
