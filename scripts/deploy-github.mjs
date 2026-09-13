import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const repository = 'alienbat/library-of-babel';
const workflow = 'github-pages.yml';
const expectedUrl = 'https://alienbat.github.io/library-of-babel/';
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(
    `Usage: npm run deploy:github [-- --check]\n\nDeploys the committed main branch of ${repository}, not the local checkout.\nRequires gh authenticated for that repository, Actions write access and permission\nto manage Pages for first-time setup. --check validates access without deploying.\nThe GitHub Pages workflow must first be approved and merged into main.\nWaits for the uniquely identified Actions run and exits nonzero on failure.`,
  );
  process.exit(0);
}
if (args.some((arg) => arg !== '--check'))
  throw new Error('Unknown argument; use --help');
const check = args.includes('--check');
function command(argv, { allowFailure = false, live = false } = {}) {
  const result = spawnSync('gh', argv, {
    encoding: 'utf8',
    stdio: live ? 'inherit' : 'pipe',
  });
  if (result.error)
    throw new Error(
      `Cannot run gh. Install GitHub CLI and run gh auth login. ${result.error.message}`,
    );
  if (result.status !== 0 && !allowFailure)
    throw new Error(
      `gh ${argv.slice(0, 2).join(' ')} failed. ${result.stderr ?? ''}`,
    );
  return result;
}
const api = (path, ...extra) =>
  command(['api', `repos/${repository}/${path}`, ...extra]).stdout;
try {
  command(['auth', 'status']);
  // Verify the workflow exists on the reviewed branch before changing any settings.
  const exists = command(
    [
      'api',
      `repos/${repository}/contents/.github/workflows/${workflow}?ref=main`,
    ],
    { allowFailure: true },
  );
  if (exists.status !== 0) {
    if (exists.stderr?.includes('HTTP 404'))
      throw new Error(
        'The deployment workflow is not on remote main yet (or is inaccessible). Approve and squash-merge its PR before deploying.',
      );
    throw new Error(`Unable to read the workflow on main: ${exists.stderr}`);
  }
  const pages = command(['api', `repos/${repository}/pages`], {
    allowFailure: true,
  });
  if (pages.status === 0) {
    const config = JSON.parse(pages.stdout);
    if (
      config.build_type !== 'workflow' ||
      config.cname ||
      config.html_url !== expectedUrl
    )
      throw new Error(
        'Pages already has a different publishing source or domain. Review repository Pages settings before deploying; no settings were changed.',
      );
  } else if (!pages.stderr?.includes('HTTP 404')) {
    throw new Error(`Cannot read Pages settings: ${pages.stderr}`);
  } else if (!check) {
    api('pages', '--method', 'POST', '-f', 'build_type=workflow');
    console.log(
      'Enabled GitHub Pages with GitHub Actions as the publishing source.',
    );
  }
  if (check) {
    console.log(
      `GitHub access and main workflow verified. ${pages.status === 0 ? 'Pages is configured.' : 'Pages will be enabled on deployment (requires repository administration access).'} No deployment started.`,
    );
    process.exit(0);
  }
  const marker = randomUUID();
  command([
    'workflow',
    'run',
    workflow,
    '--repo',
    repository,
    '--ref',
    'main',
    '-f',
    `deployment_id=${marker}`,
  ]);
  console.log(`Dispatched main to ${expectedUrl}. Waiting for GitHub Actions…`);
  let run;
  for (let attempt = 0; attempt < 45; attempt++) {
    const runs = JSON.parse(
      command([
        'run',
        'list',
        '--repo',
        repository,
        '--workflow',
        workflow,
        '--branch',
        'main',
        '--event',
        'workflow_dispatch',
        '--limit',
        '50',
        '--json',
        'databaseId,displayTitle,url',
      ]).stdout,
    );
    run = runs.find((item) => item.displayTitle === `GitHub Pages · ${marker}`);
    if (run) break;
    await delay(2000);
  }
  if (!run)
    throw new Error(
      `The dispatched run did not appear within 90 seconds. Inspect GitHub Actions for deployment ${marker}; do not assume deployment succeeded.`,
    );
  console.log(run.url);
  command(
    [
      'run',
      'watch',
      String(run.databaseId),
      '--repo',
      repository,
      '--exit-status',
      '--interval',
      '3',
    ],
    { live: true },
  );
  console.log(`Deployment succeeded: ${expectedUrl}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
