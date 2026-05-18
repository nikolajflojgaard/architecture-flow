import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ServiceTaskTopic } from '@architecture-flow/shared';

const execFileAsync = promisify(execFile);

@Injectable()
export class WorkerJobsService {
  async runServiceTask(topic: ServiceTaskTopic, workItemId: string) {
    const repoRoot = path.resolve(process.cwd(), '..', '..');
    const env = {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
      GOOGLE_DRIVE_ACCOUNT: process.env.GOOGLE_DRIVE_ACCOUNT,
      CHROME_BIN: process.env.CHROME_BIN,
    };

    const { stdout, stderr } = await execFileAsync(
      'pnpm',
      ['--filter', '@architecture-flow/worker', 'service-task', topic, workItemId],
      { cwd: repoRoot, env },
    );

    const lastLine = stdout.trim().split('\n').filter(Boolean).at(-1) ?? '{}';

    return {
      ok: true,
      ...(safeJsonParse(lastLine) as Record<string, unknown>),
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  }
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
