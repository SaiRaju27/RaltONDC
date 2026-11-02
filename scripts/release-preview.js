#!/usr/bin/env node

/**
 * release-preview.js
 * Inspects conventional commits locally since the latest git tag,
 * determines the next Semantic Version (MAJOR, MINOR, or PATCH),
 * and prints a formatted release preview.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getLatestTag() {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

function getCurrentVersion() {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  return rootPkg.version || '1.2.6';
}

function getCommitsSince(tag) {
  try {
    const range = tag ? `${tag}..HEAD` : 'HEAD';
    const log = execSync(`git log ${range} --pretty=format:"%H||%s||%b"`, { encoding: 'utf8' });
    if (!log.trim()) return [];
    return log.split('\n').map(line => {
      const [hash, subject, body = ''] = line.split('||');
      return { hash, subject, body };
    });
  } catch (e) {
    return [];
  }
}

function parseSemver(v) {
  const clean = v.replace(/^v/, '');
  const [major, minor, patch] = clean.split('.').map(n => parseInt(n, 10));
  return { major: major || 0, minor: minor || 0, patch: patch || 0 };
}

function analyzeCommits(commits) {
  let releaseType = null; // 'major' | 'minor' | 'patch' | null
  const features = [];
  const fixes = [];
  const breaking = [];
  const others = [];

  for (const c of commits) {
    const fullText = `${c.subject}\n${c.body}`;
    const isBreaking = fullText.includes('BREAKING CHANGE:') || /^(\w+)(\(.*\))?!:/.test(c.subject);

    if (isBreaking) {
      breaking.push(c.subject);
      releaseType = 'major';
      continue;
    }

    if (/^feat(\(.*\))?:/.test(c.subject)) {
      features.push(c.subject);
      if (releaseType !== 'major') {
        releaseType = 'minor';
      }
    } else if (/^(fix|perf|refactor)(\(.*\))?:/.test(c.subject)) {
      fixes.push(c.subject);
      if (!releaseType) {
        releaseType = 'patch';
      }
    } else {
      others.push(c.subject);
    }
  }

  return { releaseType, features, fixes, breaking, others };
}

const currentVersion = getCurrentVersion();
const latestTag = getLatestTag() || `v${currentVersion}`;
const commits = getCommitsSince(getLatestTag());

console.log('====================================================');
console.log('       RALT ONDC — SEMANTIC RELEASE PREVIEW         ');
console.log('====================================================');
console.log(`Current Version: ${currentVersion} (Tag: ${latestTag})`);
console.log(`Commits since last release: ${commits.length}`);

if (commits.length === 0) {
  console.log('\nNo new commits found since last release.');
  console.log('Next Version: None (repository is up to date)');
  process.exit(0);
}

const analysis = analyzeCommits(commits);
const parsed = parseSemver(currentVersion);

let nextVersion = currentVersion;
if (analysis.releaseType === 'major') {
  nextVersion = `${parsed.major + 1}.0.0`;
} else if (analysis.releaseType === 'minor') {
  nextVersion = `${parsed.major}.${parsed.minor + 1}.0`;
} else if (analysis.releaseType === 'patch') {
  nextVersion = `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

console.log(`\nSemantic Bump: ${analysis.releaseType ? analysis.releaseType.toUpperCase() : 'NONE (Chore / Docs only)'}`);
console.log(`Calculated Next Version: ${analysis.releaseType ? nextVersion : currentVersion}`);

if (analysis.breaking.length > 0) {
  console.log('\n🚨 BREAKING CHANGES:');
  analysis.breaking.forEach(s => console.log(`  - ${s}`));
}

if (analysis.features.length > 0) {
  console.log('\n✨ Features (Minor):');
  analysis.features.forEach(s => console.log(`  - ${s}`));
}

if (analysis.fixes.length > 0) {
  console.log('\n🐛 Fixes & Improvements (Patch):');
  analysis.fixes.forEach(s => console.log(`  - ${s}`));
}

if (analysis.others.length > 0) {
  console.log('\n📦 Maintenance & Docs (No bump):');
  analysis.others.forEach(s => console.log(`  - ${s}`));
}

console.log('\n====================================================\n');

