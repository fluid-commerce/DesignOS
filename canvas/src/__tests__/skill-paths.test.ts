import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SKILL_DIR = path.resolve(__dirname, '../../../.claude/skills');

const SKILLS = [
  'fluid-social',
  'fluid-one-pager',
  'fluid-theme-section',
  'fluid-design-os',
];

describe('Skill path routing audit', () => {
  for (const skill of SKILLS) {
    describe(skill, () => {
      const skillPath = path.join(SKILL_DIR, skill, 'SKILL.md');
      let content: string;

      beforeAll(() => {
        content = fs.readFileSync(skillPath, 'utf-8');
      });

      // fluid-design-os is a meta/orchestration skill that starts/stops the canvas server.
      // It does not write generated assets, so it doesn't reference .fluid/working/.
      // All other generation skills (fluid-social, fluid-one-pager, fluid-theme-section) do.
      if (skill === 'fluid-design-os') {
        it.skip('should contain .fluid/working/ output path instruction (N/A for orchestration skill)', () => {
          expect(content).toContain('.fluid/working/');
        });
      } else {
        it('should contain .fluid/working/ output path instruction', () => {
          expect(content).toContain('.fluid/working/');
        });
      }

      // Skipped: canvas-active sentinel was a CLI-era routing mechanism (Phase 04.1).
      // The API pipeline (Phase 11+) routes output directly without sentinel file checks.
      // Skill files no longer need canvas-active checks — output path is determined by
      // PipelineContext.workingDir passed by the server, not by skill files reading the sentinel.
      it.skip('should contain canvas-active sentinel check', () => {
        expect(content).toContain('canvas-active');
      });

      if (skill !== 'fluid-design-os') {
        it('should not use bare "output/" as the sole primary output path', () => {
          // The skill should mention .fluid/working/ BEFORE any ./output/ reference
          // or use ./output/ only as a fallback
          const workingIdx = content.indexOf('.fluid/working/');
          const outputIdx = content.indexOf('## Output Path');
          // Must have an Output Path section that mentions .fluid/working/
          if (outputIdx !== -1) {
            const outputSection = content.slice(outputIdx);
            expect(outputSection).toContain('.fluid/working/');
          } else {
            // Must at least mention .fluid/working/ somewhere
            expect(workingIdx).toBeGreaterThan(-1);
          }
        });
      }
    });
  }
});
