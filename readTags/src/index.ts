import { info, setOutput, setFailed, setSecret } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { isStringNullOrWhitespace } from '../../common/stringUtils.js';
import { Tags } from '../../common/types.js';
import { getRequiredInput } from '../../common/getInput.js';

async function getTags(): Promise<void> {
    if (context.eventName !== 'workflow_dispatch') {
        throw new Error('Not on workflow_dispatch event, skipping tag retrieval.');
    }

    const token = getRequiredInput('github_token');
    setSecret(token);
    if (isStringNullOrWhitespace(token)) {
        throw new Error('GitHub token is invalid.');
    }

    const octokit = getOctokit(token);

    const { status, data } = await octokit.rest.repos.listTags({
        owner: context.repo.owner,
        repo: context.repo.repo
    });

    if (status < 200 || status > 299) {
        throw new Error(`Failed to fetch tags: ${status}`);
    }

    const tags = data.reduce((acc, tag) => {
        let prefix: string;
        let version: string;

        const name = tag.name;

        if (!name.includes('/')) {
            prefix = '__names__';
            version = name;
        } else {
            const split = tag.name.split('/');

            prefix = split[0];
            version = split[1];
        }

        if (acc[prefix]) {
            acc[prefix].push(version);
        } else {
            acc[prefix] = [version];
        }

        return acc;
    }, {} as Tags);

    info(`Tags: ${JSON.stringify(tags, null, 2)}`);

    setOutput('tags', tags);
}

getTags()
    .catch(err => {
        setFailed(`Action failed with error: ${err}`);
    });
