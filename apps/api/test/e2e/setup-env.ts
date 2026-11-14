import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parseEnv } from 'util';

// Live tests read their target and credentials from .env.test at the repo
// root. Variables already set in the shell win over the file.
//
// Not process.loadEnvFile(): Jest gives each test file a sandboxed copy of
// process.env, and loadEnvFile writes to the real one, so tests never see it.
const file = resolve(__dirname, '../../../../.env.test');
if (existsSync(file)) {
  const vars = parseEnv(readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(vars)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
