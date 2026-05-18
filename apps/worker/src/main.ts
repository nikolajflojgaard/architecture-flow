import { serviceTaskTopics } from '@architecture-flow/shared';

const watchedSources = ['General designs', 'API spec drop/YAML'];

console.log('Architecture Flow worker bootstrap');
console.log(`Watched sources: ${watchedSources.join(', ')}`);
console.log(`Service task topics: ${serviceTaskTopics.join(', ')}`);
console.log('Next steps: replace direct shell-triggered jobs with durable queue/worker execution.');
