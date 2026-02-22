import { build } from 'esbuild';
import { access, mkdir, constants } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const mode = process.argv[2] === 'production' ? 'production' : 'development';
const minify = mode === 'production';
const sourcemap = mode === 'development';

const actions = [
    'package',
    'publish',
    'readProjectVersions',
    'readTags',
    'runTests'
];

async function exists(path) {
    try {
        await access(path, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

for (const name of actions) {
    const entry = resolve(name, 'src', 'index.ts');

    if (!exists(entry)) {
        // skip missing action folders
        console.warn(`Skipping ${name}: entry not found at ${entry}`);
        continue;
    }

    const outdir = resolve(name, 'dist');
    await mkdir(outdir, { recursive: true });
    const outfile = join(outdir, 'index.js');

    console.log(`Building ${name} -> ${outfile} (${mode})`);

    try {
        await build({
            entryPoints: [entry],
            bundle: true,
            platform: 'node',
            target: 'node24',
            format: 'esm',
            external: ['node:path', 'node:fs'],
            outfile,
            sourcemap,
            minify,
            logLevel: 'info'
        });
    } catch (err) {
        console.error(`Failed to build ${name}:`, err);
        process.exitCode = 1;
    }
}

// indicate success
console.log('Build complete');
