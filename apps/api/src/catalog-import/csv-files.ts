import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { CsvRow } from './catalog.types';

export async function writeCsv(
  filePath: string,
  headers: string[],
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const content = stringify(rows, {
    header: true,
    columns: headers,
    record_delimiter: 'windows',
  });
  await writeFile(filePath, content, 'utf8');
}

export async function readCsv(filePath: string): Promise<CsvRow[]> {
  const content = await readFile(filePath, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as CsvRow[];
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
