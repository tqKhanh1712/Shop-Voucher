import '../config/load-env';
import { resolve } from 'node:path';
import { crawlGiftpop } from './giftpop.crawler';
import { normalizeCatalogCsv } from './catalog.normalizer';
import { validateNormalizedCatalog } from './catalog.validator';
import { importCatalogCsv } from './catalog.importer';

type Command = 'crawl' | 'normalize' | 'validate' | 'import' | 'run';

const command = process.argv[2] as Command | undefined;
const args = process.argv.slice(3);

const argument = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const hasFlag = (name: string): boolean => args.includes(`--${name}`);

const positiveInteger = (name: string, fallback: number): number => {
  const value = argument(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return parsed;
};

const nonNegativeInteger = (name: string, fallback: number): number => {
  const value = argument(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer.`);
  }
  return parsed;
};

const defaultRunDirectory = (): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return resolve('data', 'catalog', 'giftpop', timestamp);
};

const inputDirectory = (): string => {
  const value = argument('input');
  if (!value) throw new Error('--input is required for this command.');
  return resolve(value);
};

async function execute(): Promise<void> {
  if (!command || !['crawl', 'normalize', 'validate', 'import', 'run'].includes(command)) {
    throw new Error('Use one command: crawl, normalize, validate, import, or run.');
  }

  if (command === 'crawl') {
    const outputDirectory = resolve(argument('output') ?? defaultRunDirectory());
    await crawlGiftpop({
      outputDirectory,
      limit: positiveInteger('limit', 5),
      maxBranches: nonNegativeInteger('max-branches', 10),
      urls: argument('urls')?.split(',').map((url) => url.trim()).filter(Boolean),
    });
    console.log(`Crawl CSV written to ${outputDirectory}`);
    return;
  }

  if (command === 'normalize') {
    const directory = inputDirectory();
    await normalizeCatalogCsv(directory);
    console.log(`Normalized CSV written to ${resolve(directory, 'normalized')}`);
    return;
  }

  if (command === 'validate') {
    const directory = inputDirectory();
    const result = await validateNormalizedCatalog(directory);
    console.log(
      `Validation accepted ${result.dataset.campaigns.length} campaign(s) with ${result.issues.length} issue(s).`,
    );
    if (result.issues.length > 0) process.exitCode = 1;
    return;
  }

  if (command === 'import') {
    const report = await importCatalogCsv({
      inputDirectory: inputDirectory(),
      apply: hasFlag('apply'),
      partnerId: argument('partner-id'),
    });
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const outputDirectory = resolve(argument('output') ?? defaultRunDirectory());
  await crawlGiftpop({
    outputDirectory,
    limit: positiveInteger('limit', 5),
    maxBranches: nonNegativeInteger('max-branches', 10),
    urls: argument('urls')?.split(',').map((url) => url.trim()).filter(Boolean),
  });
  await normalizeCatalogCsv(outputDirectory);
  const validation = await validateNormalizedCatalog(outputDirectory);
  if (validation.issues.length > 0) {
    throw new Error(`Pipeline stopped with ${validation.issues.length} validation issue(s).`);
  }
  const report = await importCatalogCsv({
    inputDirectory: outputDirectory,
    apply: hasFlag('apply'),
    partnerId: argument('partner-id'),
  });
  console.log(`Pipeline output: ${outputDirectory}`);
  console.log(JSON.stringify(report, null, 2));
}

execute().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
