/**
 * Refreshes the retailers that CI cannot reach, from this machine, and pushes
 * the result.
 *
 * Sainsbury's, Morrisons and Tesco answer GitHub's runner IPs with 403 — their
 * CDNs refuse datacentre traffic. A home connection is an ordinary residential
 * IP, so the same code works from here. Asda is left to the scheduled cloud
 * job, which it passes happily.
 *
 *   npm run refresh:local
 *   npm run refresh:local -- sainsburys     # just one
 *   npm run refresh:local -- --no-push      # scrape and commit, push by hand
 *
 * Pushing uses whatever git credentials this machine already has.
 */

import { spawnSync } from 'node:child_process';

const DEFAULT_STORES = 'sainsburys,morrisons,tesco';

function run(command, args, { optional = false } = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0 && !optional) {
    console.error(`\n✗ ${command} ${args.join(' ')} failed.`);
    process.exit(result.status ?? 1);
  }
  return result.status ?? 1;
}

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  return (result.stdout ?? '').trim();
}

const argv = process.argv.slice(2).filter(Boolean);
const push = !argv.includes('--no-push');
const stores = argv.find((value) => !value.startsWith('--')) ?? DEFAULT_STORES;

console.log(`Refreshing: ${stores}\n`);

// Make sure we are not about to commit on top of a stale checkout.
run('git', ['pull', '--rebase', '--autostash'], { optional: true });

// A retailer failing is not the run failing (R7): the script exits non-zero
// only when every requested store failed, and then there is nothing to commit.
const scrapeStatus = run('npm', ['run', 'refresh:static', '--', stores], { optional: true });

run('git', ['add', 'public/data']);

const staged = capture('git', ['diff', '--cached', '--name-only', '--', 'public/data']);
if (!staged) {
  console.log('\nNo price changes to commit.');
  process.exit(scrapeStatus === 0 ? 0 : 1);
}

const today = new Date().toISOString().slice(0, 10);
run('git', ['commit', '-m', `data: local price refresh ${today} (${stores})`]);

if (push) {
  run('git', ['push']);
  console.log('\n✓ Pushed. The site will rebuild itself in a minute or two.');
} else {
  console.log('\n✓ Committed. Push when you are ready.');
}
