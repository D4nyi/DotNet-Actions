import { info, warning, setOutput } from '@actions/core';
import { readFile } from 'node:fs/promises';
import { sep, resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { Versions } from '@common/types';
import { getInput } from '@common/getInput';
import { findFileByExtension } from '@common/findFileByExtension';
import { isNotNullOrWhitespace } from '@common/stringUtils';
import { Csproj } from '@common/types.js';
import { errorHandler } from '@common/errorHandler.js';

function extractVersionFromParsedProject(parsed: Csproj | undefined): string | null | undefined {
    const propertyGroups = parsed?.Project?.PropertyGroup;
    if (!propertyGroups) {
        return null;
    }

    const isPackable = propertyGroups.IsPackable;
    if (!isNotNullOrWhitespace(isPackable) || isPackable.toLowerCase() === 'false') {
        return null;
    }

    return propertyGroups.Version;
}

async function getVersionFromCsproj(filePath: string): Promise<string | null | undefined> {
    try {
        const xml = await readFile(filePath, 'utf-8');
        const parser = new XMLParser({ ignoreAttributes: true });
        const parsed = parser.parse(xml) as (Csproj | undefined);
        return extractVersionFromParsedProject(parsed);
    } catch (err: unknown) {
        warning(`Failed to parse ${filePath}: ${err}`);
        return null;
    }
}

function getFileName(filePath: string): string {
    const slash = filePath.lastIndexOf(sep);
    let dot = filePath.lastIndexOf('.');

    if (dot === -1) {
        dot = filePath.length;
    }

    return filePath.substring(slash + 1, dot);
}

async function createOutput(files: string[]) {
    const versions: Versions = {};

    let count = 0;

    for (const file of files) {
        const version = await getVersionFromCsproj(file);

        const fileName = getFileName(file);

        if (version) {
            count++;
            versions[fileName] = version;
        } else {
            warning(`${fileName} -> Version: (not found)`);
        }
    }

    info(`Versions: ${JSON.stringify(versions, undefined, 2)}`);

    if (count === 0) {
        throw new Error('No project version(s) read!')
    }

    setOutput('versions', JSON.stringify(versions));
}

const sourceDir = resolve(getInput('source_dir', process.cwd()));

findFileByExtension(sourceDir, '.csproj')
    .then(files => {
        if (!Array.isArray(files) || files.length === 0) {
            throw new Error('No .csproj files found.');
        }

        return files;
    })
    .then(createOutput)
    .catch(errorHandler);
