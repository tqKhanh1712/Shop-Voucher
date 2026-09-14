import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

const possiblePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(__dirname, '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '.env'),
];

for (const envPath of possiblePaths) {
  if (!fs.existsSync(envPath)) {
    continue;
  }

  // Load the root file first, then let apps/api/.env override it. This keeps
  // service-specific credentials (such as payment keys) usable when the app is
  // launched from the repository root.
  config({
    path: envPath,
    override: envPath.endsWith(path.join('apps', 'api', '.env')),
    quiet: true,
  });
}
