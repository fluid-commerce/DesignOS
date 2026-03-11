const fs = require('fs');
const path = require('path');

const workingDir = '/Users/cheyrasmussen/Fluid Marketing Master Skills/.fluid/working';
const sessionId = '20260312-000000';
const sessionDir = path.join(workingDir, sessionId);

const action = process.argv[2]; // 'setup' or 'cleanup'

if (action === 'cleanup') {
  fs.rmSync(sessionDir, { recursive: true, force: true });
  console.log('Cleaned up', sessionDir);
  process.exit(0);
}

// Setup
fs.mkdirSync(sessionDir, { recursive: true });

fs.writeFileSync(path.join(sessionDir, 'lineage.json'), JSON.stringify({
  sessionId,
  created: '2026-03-12T00:00:00Z',
  platform: 'instagram',
  product: 'Filter Test',
  template: null,
  rounds: [{
    roundNumber: 1,
    prompt: 'Test filtering intermediate files',
    variations: [
      { id: 'v1', path: 'styled.html', status: 'unmarked', specCheck: 'pass' },
    ],
    winnerId: null,
    timestamp: '2026-03-12T00:00:00Z',
  }],
}));

// Intermediate files (should NOT show as variations)
fs.writeFileSync(path.join(sessionDir, 'copy.html'), '<html><body>Copy only</body></html>');
fs.writeFileSync(path.join(sessionDir, 'layout.html'), '<html><body>Layout only</body></html>');

// Final file (SHOULD show)
fs.writeFileSync(path.join(sessionDir, 'styled.html'),
  '<html><body style="background:#1a1a2e;color:white;padding:20px"><h1>Final Styled</h1></body></html>');

console.log('Setup complete:', sessionDir);
