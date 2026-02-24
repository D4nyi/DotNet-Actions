import { info, warning, setFailed, setSecret } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { exec } from '@actions/exec';
import { Versions, Tags } from '../../common/types.js';
import { isStringNullOrWhitespace } from '../../common/stringUtils.js';
import { checkDotNet } from '../../common/checkDotNet.js';
import { findFileByExtension } from '../../common/findFileByExtension.js';
import { getRequiredInput } from '../../common/getInput.js';

interface Inputs {
    versions: Versions;
    tags: Tags;
    githubToken: string;
}

async function nugetPackage(): Promise<void> {
    const slnFile = await findFileByExtension(process.cwd(), '.slnx');

    if (typeof slnFile !== 'string') {
        throw new Error('No .slnx file found in the repository.');
    }

    await exec('dotnet', ['restore', slnFile]);
    await exec('dotnet', ['pack', slnFile, '--no-restore', '--nologo', '-o', 'output', '-c', 'Release']);
}

async function nugetPush(): Promise<void> {
    const nugetKey = getRequiredInput('nuget_api_key');
    setSecret(nugetKey);

    if (isStringNullOrWhitespace(nugetKey)) {
        throw new Error('NuGet API key is invalid.');
    }

    await exec('dotnet', ['nuget', 'push', 'output/*', '--api-key', nugetKey, '--source', 'https://api.nuget.org/v3/index.json', '--skip-duplicate']);
}

function parseInputs(): Inputs {
    const versionsRaw = getRequiredInput('versions');
    if (isStringNullOrWhitespace(versionsRaw)) {
        throw new Error('Versions input is invalid.');
    }

    const tagsRaw = getRequiredInput('tags');
    if (isStringNullOrWhitespace(tagsRaw)) {
        throw new Error('Tags input is invalid.');
    }

    const githubToken = getRequiredInput('github_token');
    setSecret(githubToken);
    if (isStringNullOrWhitespace(githubToken)) {
        throw new Error('GitHub token is invalid.');
    }

    return {
        versions: JSON.parse(versionsRaw),
        tags: JSON.parse(tagsRaw),
        githubToken
    };
}

async function createTag(): Promise<void> {
    const { versions, tags, githubToken } = parseInputs();

    const createRef = getOctokit(githubToken).rest.git.createRef;

    const entries = Object.entries(versions);

    const singlePackage = entries.length === 1;

    for (const [project, version] of entries) {
        if (isStringNullOrWhitespace(version)) {
            warning(`Package ('${project}') version is not defined: ${version}.`);
            continue;
        }

        const packageTags = singlePackage ? tags['__names__'] : tags[project];

        if (!Array.isArray(packageTags) || packageTags.length === 0) {
            warning(`Package tags for '${project}' is not an array or is empty.`);
            continue;
        }

        const exists = packageTags.includes(`v${version}`);

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
        } catch (error) {
            warning(`Error creating tag: '${ref}'; error: ${error}`);
        }
    }
}

checkDotNet()
    .then(nugetPackage)
    .then(nugetPush)
    .then(createTag)
    .catch((err: Error) => {
        setFailed(`Action failed with error: ${err}`);
    });
