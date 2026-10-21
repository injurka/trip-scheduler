import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { enrichActivityWithMediaAndLocation } from '../lib/enricher'
import { buildGpxIndex } from '../lib/gpx-indexer'
import { decodeXmlEntities, extractGpxReferences, haversineMeters, parseGpxContent, parseGpxFile, resolveGpxFile } from '../parsers/gpx'

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="Wikiloc" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Wikiloc - Chinan</name>
    <time>2022-06-19T10:11:50Z</time>
  </metadata>
  <trk>
    <name>Chinan - Wikiloc</name>
    <trkseg>
      <trkpt lat="23.922278" lon="121.507955"><ele>151.297</ele><time>2022-06-19T07:01:22Z</time></trkpt>
      <trkpt lat="23.922658" lon="121.508269"><ele>165.323</ele><time>2022-06-19T07:02:32Z</time></trkpt>
      <trkpt lat="23.922673" lon="121.508426"><ele>167.725</ele><time>2022-06-19T07:02:48Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('extractGpxReferences', () => {
  it('finds obsidian embeds and wikilinks with aliases', () => {
    const refs = extractGpxReferences('_Хайкинг-трек_: ![[chinan.gpx|Чинань]] и [[other.gpx]]')
    expect(refs).toHaveLength(2)
    expect(refs[0]).toMatchObject({ fileName: 'chinan.gpx', label: 'Чинань' })
    expect(refs[1]).toMatchObject({ fileName: 'other.gpx', label: undefined })
  })

  it('finds local markdown links and ignores remote gpx urls', () => {
    const refs = extractGpxReferences('[Тропа](Маршруты GPS/chinan.gpx) и [Онлайн](https://example.com/remote.gpx)')
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({ fileName: 'Маршруты GPS/chinan.gpx', label: 'Тропа' })
  })

  it('finds bare filename mentions on labeled lines and marks bike tracks', () => {
    const refs = extractGpxReferences('**Велотрек**: ride.gpx')
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({ fileName: 'ride.gpx', isBike: true })
  })

  it('does not treat filenames inside wikilinks as bare mentions twice', () => {
    const refs = extractGpxReferences('[[chinan.gpx]]')
    expect(refs).toHaveLength(1)
  })

  it('does not resolve remote URLs as local files', () => {
    expect(extractGpxReferences('https://example.com/remote.gpx')).toEqual([])
  })
})

describe('parseGpxContent', () => {
  it('extracts coordinates, name, distance and duration', () => {
    const track = parseGpxContent(SAMPLE_GPX)
    expect(track).not.toBeNull()
    expect(track!.name).toBe('Chinan')
    expect(track!.coordinates).toEqual([
      [121.507955, 23.922278],
      [121.508269, 23.922658],
      [121.508426, 23.922673],
    ])
    expect(track!.distance).toBeGreaterThan(40)
    expect(track!.duration).toBe(86)
  })

  it('returns null when there are fewer than two points', () => {
    expect(parseGpxContent('<gpx><trk><trkpt lat="1" lon="2"/></trk></gpx>')).toBeNull()
  })

  it('decodes xml entities in names', () => {
    expect(decodeXmlEntities('&#x5C0F;&amp;&#1042;')).toBe('小&В')
  })

  it('does not connect unrelated waypoints to track geometry', () => {
    const track = parseGpxContent(SAMPLE_GPX.replace('<trk>', '<wpt lat="50" lon="30"/><trk>'))!
    expect(track.coordinates).toHaveLength(3)
    expect(track.distance).toBeLessThan(100)
  })

  it('measures the original track before limiting display points', () => {
    const points = Array.from({ length: 3000 }, (_, i) => [121 + (i % 2) * 0.001, 25 + i * 0.00001] as [number, number])
    const track = parseGpxContent(`<gpx><trk><trkseg>${points.map(([lon, lat]) => `<trkpt lat="${lat}" lon="${lon}"/>`).join('')}</trkseg></trk></gpx>`)!
    const distance = points.slice(1).reduce((sum, point, i) => sum + haversineMeters(points[i], point), 0)
    expect(track.coordinates).toHaveLength(1500)
    expect(track.coordinates[0]).toEqual(points[0])
    expect(track.coordinates.at(-1)).toEqual(points.at(-1))
    expect(track.distance).toBeCloseTo(distance)
  })
})

describe('haversineMeters', () => {
  it('measures a small displacement', () => {
    const d = haversineMeters([121.507955, 23.922278], [121.508269, 23.922658])
    expect(d).toBeGreaterThan(40)
    expect(d).toBeLessThan(90)
  })
})

describe('resolveGpxFile', () => {
  it('resolves by basename, relative path and case-insensitively', () => {
    const index = new Map<string, string>([
      ['00 - Файлы и документы/PublicDocument/Маршруты GPS/chinan.gpx', '/vault/chinan.gpx'],
      ['chinan.gpx', '/vault/chinan.gpx'],
      ['chinan.GPX', '/vault/chinan.gpx'],
    ])
    expect(resolveGpxFile('chinan.gpx', index)).toBe('/vault/chinan.gpx')
    expect(resolveGpxFile('CHINAN.GPX', index)).toBe('/vault/chinan.gpx')
    expect(resolveGpxFile('Маршруты GPS/chinan.gpx', index)).toBe('/vault/chinan.gpx')
    expect(resolveGpxFile('missing.gpx', index)).toBeNull()
  })
})

describe('enricher: gpx tracks', () => {
  const tmpDirs: string[] = []
  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function makeGpxFile(name: string): { dir: string, filePath: string, gpxIndex: Map<string, string> } {
    const dir = mkdtempSync(join(tmpdir(), 'gpx-enrich-'))
    tmpDirs.push(dir)
    const filePath = join(dir, name)
    writeFileSync(filePath, SAMPLE_GPX, 'utf8')
    const gpxIndex = new Map<string, string>([[name, filePath]])
    return { dir, filePath, gpxIndex }
  }

  it('attaches a gpx wikilink as a route with full geometry', async () => {
    const { gpxIndex } = makeGpxFile('chinan.gpx')
    const rawAct = {
      startTime: '08:00',
      endTime: '12:00',
      title: 'Хайкинг Чинань',
      tag: 'walk' as const,
      sections: [{
        id: 'desc-1',
        type: 'description' as const,
        text: 'Идём по тропе.\n\n_Хайкинг-трек_: [[chinan.gpx|Тропа Чинань]]',
      }],
    }

    const res = await enrichActivityWithMediaAndLocation(
      rawAct,
      new Map(),
      null,
      null,
      new Map(),
      new Map(),
      { geocode: false, gpxIndex },
    )

    const geoSec = res.sections?.find(s => s.type === 'geolocation') as any
    expect(geoSec).toBeDefined()
    expect(geoSec.points).toHaveLength(0)
    expect(geoSec.routes).toHaveLength(1)
    expect(geoSec.routes[0]).toMatchObject({
      title: 'Тропа Чинань',
      transportMode: 'foot',
      isVisible: true,
      isFetching: false,
      duration: 86,
    })
    expect(geoSec.routes[0].geometry).toHaveLength(3)
    expect(geoSec.routes[0].distance).toBeGreaterThan(40)
    expect(geoSec.routes[0].points.map((p: any) => p.type)).toEqual(['start', 'end'])

    const descSec = res.sections?.find(s => s.type === 'description') as any
    expect(descSec?.text ?? '').not.toContain('chinan.gpx')
    expect(descSec?.text ?? '').not.toContain('[[chinan.gpx')
  })

  it('marks a bike gpx as bike transport mode', async () => {
    const { gpxIndex } = makeGpxFile('ride.gpx')
    const rawAct = {
      startTime: '09:00',
      endTime: '11:00',
      title: 'Велопрогулка',
      tag: 'walk' as const,
      sections: [{
        id: 'desc-1',
        type: 'description' as const,
        text: '_Велотрек_: [[ride.gpx]]',
      }],
    }

    const res = await enrichActivityWithMediaAndLocation(
      rawAct,
      new Map(),
      null,
      null,
      new Map(),
      new Map(),
      { geocode: false, gpxIndex },
    )

    const geoSec = res.sections?.find(s => s.type === 'geolocation') as any
    expect(geoSec.routes).toHaveLength(1)
    expect(geoSec.routes[0].transportMode).toBe('bike')
    expect(geoSec.routes[0].title).toBe('Chinan')
  })

  it('does not create a geolocation section for unresolvable gpx refs', async () => {
    const { gpxIndex } = makeGpxFile('chinan.gpx')
    const rawAct = {
      startTime: '09:00',
      endTime: '11:00',
      title: 'Без трека',
      tag: 'walk' as const,
      sections: [{
        id: 'desc-1',
        type: 'description' as const,
        text: '_Хайкинг-трек_: [[missing.gpx]]',
      }],
    }

    const res = await enrichActivityWithMediaAndLocation(
      rawAct,
      new Map(),
      null,
      null,
      new Map(),
      new Map(),
      { geocode: false, gpxIndex },
    )

    expect(res.sections?.some(s => s.type === 'geolocation')).toBe(false)
  })

  it('parses gpx files from disk', () => {
    const { filePath } = makeGpxFile('chinan.gpx')
    const track = parseGpxFile(filePath)
    expect(track?.name).toBe('Chinan')
    expect(track?.coordinates).toHaveLength(3)
  })

  it('warns about a missing GPX even when no files were indexed', async () => {
    const warnings: string[] = []
    await enrichActivityWithMediaAndLocation({
      startTime: '09:00',
      endTime: '10:00',
      title: 'Walk',
      tag: 'walk',
      sections: [{ id: 'description', type: 'description', text: '_GPX-трек_: [[missing.gpx]]' }],
    }, new Map(), null, null, new Map(), new Map(), {
      geocode: false,
      gpxIndex: new Map(),
      onProgress: message => warnings.push(message),
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('missing.gpx')
  })

  it('resolves encoded paths and refuses ambiguous filenames and path suffixes', () => {
    const { dir } = makeGpxFile('unique.gpx')
    for (const folder of ['a/Маршруты GPS', 'b/Маршруты GPS']) {
      mkdirSync(join(dir, folder), { recursive: true })
      writeFileSync(join(dir, folder, 'track.gpx'), SAMPLE_GPX)
    }
    const index = buildGpxIndex(dir)
    expect(resolveGpxFile('unique.gpx', index)).toBe(join(dir, 'unique.gpx'))
    expect(resolveGpxFile('track.gpx', index)).toBeNull()
    expect(resolveGpxFile('Маршруты GPS/track.gpx', index)).toBeNull()
    expect(resolveGpxFile('a/%D0%9C%D0%B0%D1%80%D1%88%D1%80%D1%83%D1%82%D1%8B%20GPS/track.gpx', index)).toBe(join(dir, 'a/Маршруты GPS/track.gpx'))
    expect(resolveGpxFile('missing/path/unique.gpx', index)).toBeNull()
  })
})
