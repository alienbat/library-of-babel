import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Substitute only the gh executable. No test can change a repository or deploy.
function run(scenario: string, args: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'babel-deploy-'));
  try {
    writeFileSync(
      join(dir, 'gh'),
      `#!/usr/bin/env node
const fs=require('node:fs'),a=process.argv.slice(2),dir=process.env.FIXTURE_DIR,scenario=process.env.SCENARIO;
fs.appendFileSync(dir+'/calls',JSON.stringify(a)+'\\n');
function fail(){console.error('HTTP 404');process.exit(1);}
if(a[0]==='api'&&a[1].includes('/contents/')){if(scenario==='missing')fail();console.log('{}');}
else if(a[0]==='api'&&a[1].endsWith('/pages')){
 if(a.includes('POST'))console.log('{}');
 else if(scenario==='first')fail();
 else console.log(JSON.stringify({build_type:scenario==='conflict'?'legacy':'workflow',cname:null,html_url:'https://alienbat.github.io/library-of-babel/'}));
}else if(a[0]==='workflow'){fs.writeFileSync(dir+'/marker',a.at(-1).split('=')[1]);}
else if(a[0]==='run'&&a[1]==='list')console.log(JSON.stringify([{databaseId:42,displayTitle:'GitHub Pages · '+fs.readFileSync(dir+'/marker','utf8'),url:'https://example.test/run/42'},{databaseId:99,displayTitle:'Unrelated deployment'}]));
else if(a[0]==='run'&&a[1]==='watch'&&scenario==='failure')process.exit(1);
`,
      { mode: 0o755 },
    );
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/deploy-github.mjs'), ...args],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          FIXTURE_DIR: dir,
          SCENARIO: scenario,
        },
      },
    );
    const calls = readFileSync(join(dir, 'calls'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as string[]);
    return { ...result, calls };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
void test('deployment checks are read-only and require workflow on main', () => {
  const check = run('first', ['--check']);
  assert.equal(check.status, 0);
  assert.ok(
    check.calls.every((a) => !a.includes('POST') && a[0] !== 'workflow'),
  );
  const missing = run('missing');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /squash-merge/);
  assert.equal(missing.calls.length, 2);
});
void test('deployment configures new Pages and follows only its own main run', () => {
  const result = run('first');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    result.calls.some(
      (a) => a.includes('POST') && a.includes('build_type=workflow'),
    ),
  );
  const dispatch = result.calls.find((a) => a[0] === 'workflow')!;
  assert.equal(dispatch[dispatch.indexOf('--ref') + 1], 'main');
  const watch = result.calls.find((a) => a[0] === 'run' && a[1] === 'watch')!;
  assert.equal(watch[2], '42');
  assert.ok(watch.includes('--exit-status'));
});
void test('deployment rejects conflicting configuration and propagates Actions failure', () => {
  const conflict = run('conflict');
  assert.equal(conflict.status, 1);
  assert.ok(conflict.calls.every((a) => a[0] !== 'workflow'));
  const failed = run('failure');
  assert.equal(failed.status, 1);
  assert.ok(!failed.stdout.includes('Deployment succeeded'));
});
