import { debug, info, warning, getInput, setFailed, setSecret } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { exec } from "@actions/exec";
import { resolve, } from 'node:path';
import { DefaultArtifactClient, type DownloadArtifactOptions, type FindOptions } from '@actions/artifact'
import { Versions, Tags } from "../../common/types.js";
import { isStringNullOrWhitespace } from "../../common/stringUtils.js";

interface Inputs {
    versions: Versions;
    tags: Tags;
    githubToken: string;
}

async function runDotNet() {
    const dotnetInstalled = await exec("which dotnet", null!, { ignoreReturnCode: true });

    info(`.NET Installed: ${!dotnetInstalled}`);

    if (dotnetInstalled !== 0) {
        throw new Error(".NET CLI is not installed or not found in PATH.");
    }

    const nugetKey = getInput('nuget_api_key', { required: true });
    setSecret(nugetKey);

    if (isStringNullOrWhitespace(nugetKey)) {
        throw new Error('NuGet API key is invalid.');
    }

    await exec("dotnet", ["nuget", "push", "output/*.nupkg", "--skip-duplicate", "--source", "https://api.nuget.org/v3/index.json", "--api-key", nugetKey]);
}

async function downloadArtifact(): Promise<void> {
    const artifactId = getInput('artifact_id', { required: true });
    const artifactDigest = getInput('artifact_digest', { required: false });

    const numericId = parseInt(artifactId, 10);
    if (isNaN(numericId)) {
        throw new Error(`Invalid artifact ID: '${artifactId}'. Must be a number.`)
    }

    const resolvedPath = resolve('./output')
    debug(`Resolved path is ${resolvedPath}`)

    const options: DownloadArtifactOptions & FindOptions = {
        path: resolvedPath,
        expectedHash: artifactDigest,
        skipDecompress: false,
        findBy: {
            token: null!, // Not needed for artifacts within the same run
            workflowRunId: context.runId,
            repositoryOwner: context.repo.owner,
            repositoryName: context.repo.repo,
        }
    }

    const artifact = new DefaultArtifactClient();

    const result = await artifact.downloadArtifact(numericId, options);

    if (result.digestMismatch) {
        warning(`Artifact '${artifactId}' digest validation failed. Please verify the integrity of the artifact.`);
    }

    if (result.downloadPath != resolvedPath) {
        warning(`Downloaded path '${result.downloadPath}' does not match the expected path '${resolvedPath}'. This may indicate an issue with artifact download.`);
    }

    info('Download artifact has finished successfully')
}

function parseInputs(): Inputs {
    const versionsRaw = getInput('versions', { required: true });
    if (isStringNullOrWhitespace(versionsRaw)) {
        throw new Error('Versions input is invalid.');
    }
    
    const tagsRaw = getInput('tags', { required: true });
    if (isStringNullOrWhitespace(tagsRaw)) {
        throw new Error('Tags input is invalid.');
    }

    const githubToken = getInput('github_token', { required: true });
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

async function createTag() {
    const { versions, tags, githubToken } = parseInputs();

    const createRef = getOctokit(githubToken).rest.git.createRef;

    for (const [key, value] of Object.entries(versions)) {
        if (!value) {
            continue;
        }

        const packageTags = tags[key];

        if (!Array.isArray(packageTags) || packageTags.length === 0) {
            warning(`Package tags for '${key}' is not an array or is empty.`);
            continue;
        }

        const ref = `refs/tags/${key}/v${value}`;
        const exists = packageTags.includes(ref);

        if (exists) {
            info(`Tag exists: ${ref}`);
            continue;
        }

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

downloadArtifact()
    .then(runDotNet)
    .then(createTag)
    .catch(err => {
        setFailed(`Action failed with error: ${err}`);
    });
