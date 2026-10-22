"""Read-only profiling of a local GeoNames cities ZIP for this research plan.

This measurement helper uses in-memory data structures. It is not the proposed
streaming production importer and does not measure PostgreSQL or JS heap size.
No network access or database writes are performed.
"""

import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path
import zipfile


ALLOWLIST = [
    "PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLA5", "PPLC",
    "PPLCD", "PPLG", "PPLF", "PPLL", "PPLR", "STLMT",
]
PROBES = [
    ("Tokyo", "JP"), ("Kyoto", "JP"), ("Kamakura", "JP"),
    ("Hakone", "JP"), ("Nara", "JP"), ("Osaka", "JP"),
    ("Hiroshima", "JP"), ("Miyajima", "JP"),
    ("Артыбаш", "RU"), ("Териберка", "RU"), ("Тайбэй", "TW"),
    ("Гаосюн", "TW"), ("Гонконг", "HK"),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--observed-date", required=True)
    args = parser.parse_args()

    with zipfile.ZipFile(args.archive) as archive:
        members = [m for m in archive.infolist() if m.filename.endswith(".txt")]
        if len(members) != 1:
            raise ValueError("Expected one GeoNames cities text member")
        member = members[0]
        raw = archive.read(member.filename)
    rows = [line.split("\t") for line in raw.decode("utf-8").splitlines() if line]
    if any(len(row) != 19 for row in rows):
        raise ValueError("Unexpected GeoNames TSV column count")
    names = collections.Counter(row[1].casefold() for row in rows)
    feature_codes = collections.Counter(row[7] for row in rows)

    coverage = {name: [] for name, _ in PROBES}
    for row in rows:
        probes = [(name, cc) for name, cc in PROBES if row[8] == cc]
        if not probes:
            continue
        aliases = {name.casefold() for name in [row[1], row[2], *row[3].split(",")]}
        for name, _ in probes:
            if name.casefold() in aliases:
                coverage[name].append({
                    "geonamesId": int(row[0]), "name": row[1],
                    "countryCode": row[8], "featureCode": row[7],
                    "population": int(row[14] or 0),
                    "latitude": float(row[4]), "longitude": float(row[5]),
                })

    compact = [{
        "geonamesId": int(row[0]), "name": row[1], "asciiName": row[2],
        "countryCode": row[8], "admin1Code": row[10],
        "latitude": float(row[4]), "longitude": float(row[5]),
        "population": int(row[14] or 0), "timezone": row[17],
        "featureCode": row[7],
    } for row in rows]
    compact_bytes = json.dumps(compact, ensure_ascii=False, separators=(",", ":")).encode()
    report = {
        "source": args.source_url,
        "retrievedDate": args.observed_date,
        "zipBytes": args.archive.stat().st_size,
        "sha256": hashlib.sha256(args.archive.read_bytes()).hexdigest(),
        "member": member.filename,
        "memberTimestamp": list(member.date_time),
        "memberTimestampNote": "ZIP member local timestamp; no timezone is encoded",
        "uncompressedBytes": len(raw), "rows": len(rows),
        "countries": len({row[8] for row in rows}),
        "featureCodes": dict(feature_codes),
        "primaryNameCollisionGroups": sum(count > 1 for count in names.values()),
        "recordsInPrimaryNameCollisionGroups": sum(count for count in names.values() if count > 1),
        "compactJsonBytes": len(compact_bytes),
        "compactJsonGzipBytes": len(gzip.compress(compact_bytes, compresslevel=9, mtime=0)),
        "compactJsonScope": "10 selected fields, all source rows; no language-aware Russian aliases; not PostgreSQL or JS heap size",
        "coverageProbeMode": "Exact casefold match in primary/ascii/unlabelled aliases with country filter; not a preferred-language or identity proof",
        "coverage": coverage,
        "proposedAllowlist": ALLOWLIST,
        "proposedEligibleRows": sum(row[7] in ALLOWLIST for row in rows),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
