import { info, warning, getInput, setFailed, setSecret } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { exec } from "@actions/exec";
import { Versions, Tags } from "../../common/types.js";
import { isStringNullOrWhitespace } from "../../common/stringUtils.js";
import { checkDotNet } from "../../common/checkDotNet.js";
import { findFileByExtension } from "../../common/findFileByExtension.js";

interface Inputs {
    versions: Versions;
    tags: Tags;
    githubToken: string;
}

async function nugetPackage(): Promise<void> {
    const slnFile = findFileByExtension(process.env.GITHUB_WORKSPACE || process.cwd(), ".slnx");

    if (typeof slnFile !== "string") {
        setFailed("No .slnx file found in the repository.");
        return;
    }

    await exec("dotnet", ["restore", slnFile]);
    await exec("dotnet", ["pack", slnFile, "--no-restore", "--nologo", "-o", "output", "-c", "Release"]);
}

async function nugetPush(): Promise<void> {
    await checkDotNet();

    const nugetKey = getInput('nuget_api_key', { required: true });
    setSecret(nugetKey);

    if (isStringNullOrWhitespace(nugetKey)) {
        throw new Error('NuGet API key is invalid.');
    }

    await exec("dotnet", ["nuget", "push", "output/*", "--skip-duplicate", "--source", "https://api.nuget.org/v3/index.json", "--api-key", nugetKey]);
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

async function createTag(): Promise<void> {
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

checkDotNet()
    .then(nugetPackage)
    .then(nugetPush)
    .then(createTag)
    .catch(err => {
        setFailed(`Action failed with error: ${err}`);
    });
