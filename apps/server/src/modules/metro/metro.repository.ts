import type { z } from 'zod'
import type { MetroSystem, MetroSystemDetails } from './metro.types'
import type { ImportMetroSystemInputSchema } from '~/modules/metro/metro.schemas'
import { db, toId } from '~/db'

export const metroRepository = {
  async findSystems(): Promise<MetroSystem[]> {
    const [systems] = await db.query<[MetroSystem[]]>(
      'SELECT * FROM metro_system ORDER BY city ASC',
    )
    return systems || []
  },

  async findSystemWithDetails(systemId: string): Promise<MetroSystemDetails | null> {
    const systemRecordId = toId('metro_system', systemId)

    const [results] = await db.query<[MetroSystemDetails[]]>(
      `
      SELECT
          id,
          city,
          country,
          (
              SELECT
                  id,
                  name,
                  color,
                  lineNumber,
                  (
                      SELECT out.id as id, out.name as name
                      FROM includes_station
                      WHERE in = metro_line.id
                      ORDER BY order ASC
                  ) AS stations
              FROM metro_line WHERE system = ${systemRecordId}
          ) AS lines
      FROM ONLY ${systemRecordId};
    `,
    )

    const details = results?.[0]

    if (!details) {
      return null
    }

    return details
  },

  async importSystem(
    data: z.infer<typeof ImportMetroSystemInputSchema>,
  ): Promise<MetroSystem> {
    const query = `
      LET $p_system_data = $data;

      LET $system = (CREATE metro_system CONTENT {
          id: string::concat("metro_system:", $p_system_data.id),
          city: $p_system_data.city,
          country: $p_system_data.country
      } ON DUPLICATE KEY UPDATE
          city = $p_system_data.city,
          country = $p_system_data.country
      );

      FOR $line IN $p_system_data.lines {
          LET $line_id = string::concat("metro_line:", $line.id);
          LET $line_record = (CREATE metro_line CONTENT {
              id: $line_id,
              system: $system.id,
              name: $line.name,
              lineNumber: $line.lineNumber,
              color: $line.color
          } ON DUPLICATE KEY UPDATE
              name = $line.name,
              lineNumber = $line.lineNumber,
              color = $line.color
          );

          FOR $station_info IN array::enumerate($line.stations) {
              LET $station_id = string::concat("metro_station:", $station_info.value.id);
              LET $station_record = (CREATE metro_station CONTENT {
                  id: $station_id,
                  system: $system.id,
                  name: $station_info.value.name
              } ON DUPLICATE KEY UPDATE name = $station_info.value.name);

              LET $existing_rel = (SELECT value id FROM includes_station WHERE in = $line_record.id AND out = $station_record.id);
              IF count($existing_rel) > 0 {
                UPDATE $existing_rel SET order = $station_info.index;
              } ELSE {
                RELATE $line_record->includes_station->$station_record SET order = $station_info.index;
              }
          }
      };

      RETURN $system;
    `
    const [result] = await db.query<[MetroSystem]>(query, { data })

    if (!result) {
      throw new Error('Не удалось импортировать систему метро.')
    }

    return result
  },
}
