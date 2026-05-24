import { runServiceTaskJob } from "./service-task-jobs";

const workItemId = process.argv[2];

if (!workItemId) {
  console.error("Usage: tsx src/render-openapi-pdf.ts <workItemId>");
  process.exit(1);
}

void main();

async function main() {
  try {
    const result = await runServiceTaskJob("artifact.render-pdf", workItemId);
    console.log(JSON.stringify(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
