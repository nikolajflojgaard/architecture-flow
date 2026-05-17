import type { ReactNode } from 'react';

const intakeSources = [
  'Data - NET / General designs',
  'Data - NET / API spec drop / YAML',
];

const nextSlices = [
  'Wire intake state from database',
  'Add authenticated inbox and work-item views',
  'Connect PDF artifacts to live work items',
];

export default function HomePage() {
  return (
    <main style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <p style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5 }}>Architecture Flow</p>
        <h1 style={{ fontSize: 42, margin: '8px 0 12px' }}>Architecture workflow manager</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 760, lineHeight: 1.6 }}>
          Intake messy source files, move them through structured workflow, and keep every artifact from design doc to OpenAPI PDF tied together.
        </p>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card title="Current intake sources">
          <ul>
            {intakeSources.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card title="Next implementation slices">
          <ul>
            {nextSlices.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </section>

      <Card title="Initial product modules">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
          {[
            'Inbox',
            'Work item detail',
            'Artifact chain',
            'BPMN workflow state',
            'Drive intake sync',
            'OpenAPI PDF rendering',
          ].map((item) => (
            <div key={item} style={{ padding: 14, border: '1px solid #22304d', borderRadius: 12, background: '#0f172a' }}>
              {item}
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ background: '#131a2b', border: '1px solid #22304d', borderRadius: 16, padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div style={{ color: '#cbd5e1', lineHeight: 1.6 }}>{children}</div>
    </section>
  );
}
