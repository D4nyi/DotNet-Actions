import { info, setOutput, setFailed, getInput } from "@actions/core";
import { context } from "@actions/github";
import { DefaultArtifactClient } from '@actions/artifact'
import { exec } from "@actions/exec";
import { findFileByExtension } from "../../common/findFileByExtension.js";
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

interface SearchResult {
    filesToUpload: string[]
    rootDirectory: string
}

async function runDotNet() {
    const dotnetInstalled = await exec("which dotnet", null!, { ignoreReturnCode: true });

    info(`.NET Installed: ${!dotnetInstalled}`);

    if (dotnetInstalled !== 0) {
        throw new Error(".NET CLI is not installed or not found in PATH.");
    }

    const slnFile = findFileByExtension(process.env.GITHUB_WORKSPACE || process.cwd(), ".slnx");

    if (typeof slnFile !== "string") {
        setFailed("No .slnx file found in the repository.");
        return;
    }

    await exec("dotnet", ["restore", slnFile]);
    await exec("dotnet", ["pack", slnFile, "--no-restore", "--nologo", "-o", "output", "-c", "Release"]);
}

function findPackages(): SearchResult {
    const files = readdirSync('./output/', { withFileTypes: true })
        .filter(file => file.isDirectory() && file.name.endsWith('nupkg'))
        .map(file => file.name);

    return {
        filesToUpload: files,
        rootDirectory: resolve('./output/')
    };
}

async function uploadArtifacts() {
    const artifactName = getInput('artifact-name') || 'dotnet-workflows-artifact';

    const files = findPackages();

    const artifact = new DefaultArtifactClient();

    const uploadResponse = await artifact.uploadArtifact(
        artifactName,
        files.filesToUpload,
        files.rootDirectory,
        {
            compressionLevel: 0,
            retentionDays: 1
        }
    );

    info(`Artifact ${artifactName} has been successfully uploaded! Final size is ${uploadResponse.size} bytes. Artifact ID is ${uploadResponse.id}`);

    setOutput('artifact-id', uploadResponse.id);
    setOutput('artifact-digest', uploadResponse.digest);

    const repository = context.repo;
    const artifactURL = `${context.serverUrl}/${repository.owner}/${repository.repo}/actions/runs/${context.runId}/artifacts/${uploadResponse.id}`;

    info(`Artifact download URL: ${artifactURL}`);
    setOutput('artifact-url', artifactURL);
}

runDotNet()
    .then(uploadArtifacts)
    .catch(err => {
        setFailed(`Action failed with error: ${err}`);
        process.exit(1);
    });
