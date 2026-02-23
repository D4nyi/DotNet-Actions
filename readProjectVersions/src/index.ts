import { info, warning, setFailed, setOutput } from "@actions/core";
import { readdirSync, readFileSync } from 'node:fs';
import { sep, join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { ignoreCaseCompare, isStringNullOrWhitespace } from "../../common/stringUtils";
import { Versions } from "../../common/types";
import { getInput } from "../../common/getInput";

function findCsprojFiles(dir: string): string | string[] {
    const elements = readdirSync(dir, { withFileTypes: true });

    const grouped = Object.groupBy(elements, element => {
        if (element.name.endsWith(".csproj")) {
            return "csproj";
        }

        if (element.name !== "bin" && element.name !== "obj" && element.isDirectory()) {
            return "directories";
        }

        return "excluded";
    });

    if (Array.isArray(grouped.csproj) && grouped.csproj.length > 0) {
        return join(grouped.csproj[0].parentPath, grouped.csproj[0].name);
    }

    if (!Array.isArray(grouped.directories) || grouped.directories.length === 0) {
        return [];
    }

    const results: string[] = [];

    for (const element of grouped.directories) {
        const subResult = findCsprojFiles(join(element.parentPath, element.name));

        if (typeof subResult === "string") {
            results.push(subResult);
        } else if (Array.isArray(subResult)) {
            results.push(...subResult);
        }
    }

    return results;
}

function extractVersionFromParsedProject(parsed: any): string | null {
    if (!parsed) return null;

    const project = parsed.Project ?? parsed.project;
    if (!project) return null;

    const propertyGroups = project.PropertyGroup ?? project.propertyGroup;
    if (!propertyGroups) return null;

    const isPackable = propertyGroups.IsPackable ?? propertyGroups.isPackable;
    if (!isStringNullOrWhitespace(isPackable) && ignoreCaseCompare(isPackable, "false")) {
        return null;
    }

    return propertyGroups.Version ?? propertyGroups.version;
}

function getVersionFromCsproj(filePath: string): string | null {
    try {
        const xml = readFileSync(filePath, 'utf-8');
        const parser = new XMLParser({ ignoreAttributes: true });
        const parsed = parser.parse(xml);
        return extractVersionFromParsedProject(parsed);
    } catch (err) {
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

const sourceDir = getInput('source_dir', process.cwd());

const files = findCsprojFiles(sourceDir);

if (files.length === 0) {
    setFailed('No .csproj files found.');
    process.exit(1);
}

const versions: Versions = {};

for (const file of files) {
    const version = getVersionFromCsproj(file);

    const fileName = getFileName(file);

    if (version) {
        info(`${fileName} -> Version: ${version}`);

        versions[fileName] = version;
    } else {
        warning(`${fileName} -> Version: (not found)`);
    }
}

setOutput('versions', JSON.stringify(versions));
