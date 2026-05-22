import { runDriveIntakeSync } from '@architecture-flow/intake-sync';

void main();

async function main() {
  try {
    const summary = await runDriveIntakeSync();

    for (const source of summary.sources) {
      if (source.skipped) {
        console.warn(`${source.displayName}: skipped (${source.skipped})`);
        continue;
      }

      console.log(
        `${source.displayName}: scanned ${source.scanned}, discovered ${source.discovered}, enriched ${source.enriched}`,
      );
    }

    console.log(
      `totals: scanned ${summary.totals.scanned}, discovered ${summary.totals.discovered}, enriched ${summary.totals.enriched}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
