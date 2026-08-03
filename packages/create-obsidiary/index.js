#!/usr/bin/env node
/**
 * create-obsidiary — scaffold a site that publishes an Obsidian vault.
 *
 * Zero dependencies on purpose. This is the first thing anyone runs, and a
 * scaffolder that pulls forty packages before it has asked a single question is
 * a bad first impression.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, 'template');

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item.startsWith('--')) {
      const [key, inline] = item.slice(2).split('=');
      if (inline !== undefined) args[key] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) args[key] = argv[++i];
      else args[key] = true;
    } else {
      args._.push(item);
    }
  }
  return args;
}

/** `owner/repo`, `owner/repo@branch`, a subdirectory, or a full GitHub URL. */
function normalizeRepo(input) {
  const text = String(input)
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/tree\//, '@')
    .replace(/^([^/]+\/[^/]+)@([^/]+)\/(.+)$/, '$1/$3@$2');
  return /^[^/]+\/[^/]+/.test(text) ? text : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('');
  console.log(c.bold('  Obsidiary') + c.dim(' — publish an Obsidian vault as a website'));
  console.log('');

  const rl = args.yes ? null : createInterface({ input: stdin, output: stdout });
  const ask = async (question, fallback) => {
    if (!rl) return fallback;
    const answer = (await rl.question(`  ${question}${fallback ? c.dim(` (${fallback})`) : ''} `)).trim();
    return answer || fallback;
  };

  try {
    const dir = args._[0] ?? (await ask('Folder name?', 'my-notes-site'));
    const target = resolve(process.cwd(), dir);

    if (existsSync(target) && readdirSync(target).length > 0) {
      console.log(c.red(`\n  ${target} already exists and is not empty.\n`));
      process.exit(1);
    }

    const title = args.title ?? (await ask('Site title?', 'My Notes'));

    // Two shapes: the vault lives beside the site, or in its own repository.
    let source = args.repo ? 'repo' : args.vault ? 'local' : null;
    if (!source) {
      const answer = await ask('Where are your notes? [local/repo]', 'local');
      source = answer.toLowerCase().startsWith('r') ? 'repo' : 'local';
    }

    let repo = null;
    if (source === 'repo') {
      const raw = args.repo ?? (await ask('GitHub repo with your notes?', 'owner/notes'));
      repo = normalizeRepo(raw);
      if (!repo) {
        console.log(c.red('\n  That does not look like a GitHub repository.\n'));
        process.exit(1);
      }
    }

    mkdirSync(target, { recursive: true });
    cpSync(TEMPLATE, target, { recursive: true });

    // npm refuses to publish a directory containing .gitignore, so the template
    // ships it renamed and it is restored here.
    const stashed = join(target, 'gitignore');
    if (existsSync(stashed)) {
      cpSync(stashed, join(target, '.gitignore'));
      writeFileSync(stashed, '');
      const { unlinkSync } = await import('node:fs');
      unlinkSync(stashed);
    }

    const configPath = join(target, 'astro.config.mjs');
    const config = readFileSync(configPath, 'utf8')
      .replace('__TITLE__', title.replace(/'/g, "\\'"))
      .replace(
        "vault: './vault',",
        repo ? `repo: '${repo}',` : "vault: './vault',",
      );
    writeFileSync(configPath, config);

    const pkgPath = join(target, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    pkg.name = basename(target).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

    if (repo) {
      // A remote vault makes the bundled sample notes misleading.
      const { rmSync } = await import('node:fs');
      rmSync(join(target, 'vault'), { recursive: true, force: true });
    }

    console.log('');
    console.log(c.green('  Done.') + c.dim(` Created ${dir}`));
    console.log('');
    console.log('  Next:');
    console.log(c.dim('    cd ') + dir);
    console.log(c.dim('    npm install'));
    console.log(c.dim('    npm run dev'));
    console.log('');
    if (repo) {
      console.log(`  Publishing ${c.blue(repo)}.`);
    } else {
      console.log(`  Put your markdown in ${c.blue(`${dir}/vault/`)} — or open that folder as an Obsidian vault.`);
    }
    console.log('');
    console.log(
      `  Notes not organised? ${c.blue('SHAPE-YOUR-VAULT.md')} has a prompt that gives a`,
    );
    console.log('  folder of loose markdown folders, tags and links — via Claude Code,');
    console.log('  Codex, or any agent that can read the folder.');
    console.log('');
    console.log(c.dim('  Deploy guide: https://obsidiary.pulsar-projects.org/docs/setup'));
    console.log('');
  } finally {
    rl?.close();
  }
}

main().catch((error) => {
  console.error(c.red(`\n  ${error instanceof Error ? error.message : error}\n`));
  process.exit(1);
});
