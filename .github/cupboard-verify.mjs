#!/usr/bin/env node
/* Trusted first-party Cupboard mirror gate. It is dependency-free so CI never
 * runs publisher-controlled install hooks. The three checks intentionally mirror
 * the hosted publish gate: scanIdentityLeaks, schema validation, checkScript. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';

const root = process.cwd();
const errors = [];
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) files.push(relative(root, full).replaceAll('\\', '/'));
  }
}

walk(root);
const textOf = (file) => readFileSync(join(root, file), 'utf8');

function scanIdentityLeaks(text, file) {
  const patterns = [
    [/\/(?:home|Users)\/[A-Za-z0-9._-]+/g, 'home path'],
    [/\bsu-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, 'agent session id'],
    [/[A-Za-z0-9._%+-]+@[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*)+/g, 'email'],
    [/(?:sk-|ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]{16,}/g, 'token'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, 'private key'],
    [/(?:secret|token|password|api[_-]?key|private[_-]?key)["'\s]*[:=]\s*["']?[^\s"',;&)}\]]{8,}/gi, 'key-directed secret'],
  ];
  for (const [pattern, kind] of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[0];
      if (!value.includes('example.invalid') && !value.includes('<') && !value.includes('su-deadbee')) {
        errors.push(`${file}: identity leak (${kind})`);
      }
    }
  }
}

function parseJson(file) {
  try {
    return JSON.parse(textOf(file));
  } catch (error) {
    errors.push(`${file}: invalid JSON (${error.message})`);
    return null;
  }
}

function validateListingSchema(file, listing) {
  if (!listing || typeof listing !== 'object' || Array.isArray(listing)) return null;
  const kind = typeof listing.kind === 'string'
    ? listing.kind
    : listing.scope === 'rubric' ? 'rubric' : 'template';
  for (const key of ['id', 'title', 'version']) {
    if (typeof listing[key] !== 'string' || listing[key].length === 0) {
      errors.push(`${file}: listing.${key} is required`);
    }
  }
  if (!kind) errors.push(`${file}: listing.kind (or recognized scope) is required`);
  if (typeof listing.id === 'string' && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(listing.id)) {
    errors.push(`${file}: listing.id has invalid characters`);
  }
  return kind;
}

function checkScript(source, file) {
  const stack = [];
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  const templateQuote = String.fromCharCode(96);
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    const n = source[i + 1];
    if (lineComment) {
      if (c === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === '*' && n === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (c === '/' && n === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === templateQuote) {
      quote = c;
      continue;
    }
    if ('({['.includes(c)) stack.push(c);
    else if (')}]'.includes(c)) {
      const expected = ({ ')': '(', ']': '[', '}': '{' })[c];
      if (stack.pop() !== expected) errors.push(`${file}: checkScript delimiter mismatch near offset ${i}`);
    }
  }
  if (quote || blockComment || stack.length) errors.push(`${file}: checkScript found unterminated syntax`);
}

const listingFiles = files.filter((file) => file.endsWith('/listing.json') || file === 'listing.json');
for (const listingFile of listingFiles) {
  const listing = parseJson(listingFile);
  const kind = validateListingSchema(listingFile, listing);
  if (!kind) continue;
  const dir = dirname(listingFile);
  const prefix = dir === '.' ? '' : `${dir}/`;
  const required = {
    recipe: 'recipe.json',
    plan: 'plan.md',
    goal: 'goal.json',
    rubric: 'rubric.json',
    template: 'template.yaml',
  }[kind];
  if (required && !files.includes(prefix + required)) errors.push(`${listingFile}: missing ${required}`);
  if (kind === 'recipe' && files.includes(prefix + 'recipe.json')) {
    const recipeFile = prefix + 'recipe.json';
    const recipe = parseJson(recipeFile);
    if (recipe && typeof recipe.script === 'string') checkScript(recipe.script, recipeFile);
    if (recipe && recipe.tools_used && !Array.isArray(recipe.tools_used)) {
      errors.push(`${recipeFile}: tools_used must be an array`);
    }
  }
  // Scan shipped payloads only; test fixtures and explanatory prose are not
  // published bytes and intentionally contain detector counterexamples.
  scanIdentityLeaks(textOf(listingFile), listingFile);
  if (required && files.includes(prefix + required)) scanIdentityLeaks(textOf(prefix + required), prefix + required);
}

if (errors.length) {
  console.error('cupboard-verify failed');
  for (const error of [...new Set(errors)]) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`cupboard-verify passed: ${listingFiles.length} listing(s), identity scan clean, schemas valid, checkScript clean`);
