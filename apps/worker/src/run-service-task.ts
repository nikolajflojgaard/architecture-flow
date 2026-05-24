import { isServiceTaskTopic, runServiceTaskJob } from "./service-task-jobs";

const rawTopic = process.argv[2];
const workItemId = process.argv[3];

if (!rawTopic || !workItemId) {
  console.error("Usage: tsx src/run-service-task.ts <topic> <workItemId>");
  process.exit(1);
}

if (!isServiceTaskTopic(rawTopic)) {
  console.error(`Unsupported service task topic: ${rawTopic}`);
  process.exit(1);
}

const topic = rawTopic;

void main();

async function main() {
  try {
    const result = await runServiceTaskJob(topic, workItemId);
    console.log(JSON.stringify(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
