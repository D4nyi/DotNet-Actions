import { info, warning, setSecret } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { exec } from '@actions/exec';
import { Versions, Tags } from '@common/types.js';
import { isNullOrWhitespace } from '@common/stringUtils.js';
import { checkDotNet } from '@common/checkDotNet.js';
import { findFileByExtension } from '@common/findFileByExtension.js';
import { getRequiredInput } from '@common/getInput.js';
import { readdir } from 'node:fs/promises';
import { errorHandler, getErrorMessage } from '@common/errorHandler.js';

interface Inputs {
    versions: Versions;
    tags: Tags;
    githubToken: string;
}

async function hasSymbolPackage(): Promise<boolean> {
    const outputFiles: string[] = await readdir('output');
    return outputFiles.some(el => el.endsWith('.snupkg'));
}

async function nugetPackage(): Promise<void> {
    const slnFile = await findFileByExtension(process.cwd(), '.slnx');

    if (typeof slnFile !== 'string') {
        throw new Error('No .slnx file found in the repository.');
    }

    await exec('dotnet', ['restore', slnFile]);
    await exec('dotnet', ['build', slnFile, '--no-restore', '--nologo', '-c', 'Release']);
    await exec('dotnet', ['pack', slnFile, '--no-restore', '--no-build', '--nologo', '-o', 'output', '-c', 'Release']);
}

async function nugetPush(): Promise<void> {
    const nugetKey = getRequiredInput('nuget_api_key');
    setSecret(nugetKey);

    if (isNullOrWhitespace(nugetKey)) {
        throw new Error('NuGet API key is invalid.');
    }

    await exec('dotnet', ['nuget', 'push', 'output/*.nupkg', '--api-key', nugetKey, '--source', 'https://api.nuget.org/v3/index.json', '--skip-duplicate']);

    const hasSymbol = await hasSymbolPackage();
    if (hasSymbol) {
        await exec('dotnet', ['nuget', 'push', 'output/*.snupkg', '--api-key', nugetKey, '--source', 'https://symbols.nuget.org/download/symbols', '--skip-duplicate']);
    }
}

function parseInputs(): Inputs {
    const versionsRaw = getRequiredInput('versions');
    if (isNullOrWhitespace(versionsRaw)) {
        throw new Error('Versions input is invalid.');
    }

    const tagsRaw = getRequiredInput('tags');
    if (isNullOrWhitespace(tagsRaw)) {
        throw new Error('Tags input is invalid.');
    }

    const githubToken = getRequiredInput('github_token');
    setSecret(githubToken);
    if (isNullOrWhitespace(githubToken)) {
        throw new Error('GitHub token is invalid.');
    }

    return {
        versions: JSON.parse(versionsRaw) as Versions,
        tags: JSON.parse(tagsRaw) as Tags,
        githubToken
    };
}

async function createTag(): Promise<void> {
    const { versions, tags, githubToken } = parseInputs();

    const createRef = getOctokit(githubToken).rest.git.createRef;

    const entries = Object.entries(versions);

    const singlePackage = entries.length === 1;

    for (const [project, version] of entries) {
        if (isNullOrWhitespace(version)) {
            warning(`Package ('${project}') version is not defined: ${version}.`);
            continue;
        }

        const packageTags = singlePackage ? tags['__names__'] : tags[project];

        const exists = packageTags?.includes(`v${version}`) ?? false;

        if (exists) {
            info(`Tag exists: v${version}`);
            continue;
        }

        const ref = singlePackage
            ? `refs/tags/v${version}`
            : `refs/tags/${project}/v${version}`;

        try {
            const { status, data } = await createRef({
                owner: context.repo.owner,
                repo: context.repo.repo,
                ref: ref,
                sha: context.sha
            });

            if (status < 200 || status > 299) {
                warning(`Failed to create tag '${ref}': ${status}`);
            } else {
                info(`Created tag with ref: ${data.ref}`);
            }
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            warning(`Error creating tag: '${ref}'; error: ${message}`);
        }
    }
}

checkDotNet()
    .then(nugetPackage)
    .then(nugetPush)
    .then(createTag)
    .catch(errorHandler);
