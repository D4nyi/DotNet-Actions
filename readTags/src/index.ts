import { info, getInput, setOutput, setFailed, setSecret } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { isStringNullOrWhitespace } from "../../common/stringUtils.js";

async function getTags(): Promise<void> {
    if (context.eventName !== 'workflow_dispatch') {
        info("Not on workflow_dispatch event, skipping tag retrieval.");
        return;
    }

    const token = getInput('github_token', { required: true });
    setSecret(token);

    if (isStringNullOrWhitespace(token)) {
        throw new Error("GitHub token is invalid.");
    }

    const octokit = getOctokit(token);

    try {
        const { status, data } = await octokit.rest.repos.listTags({
            owner: context.repo.owner,
            repo: context.repo.repo
        });

        if (status < 200 || status > 299) {
            setFailed(`Failed to fetch tags: ${status}`);
            return;
        }

        const tags = data.reduce((acc, tag) => {
            const split = tag.name.split('/');

            const prefix = split[0];
            const version = split[1];

            if (acc[prefix]) {
                acc[prefix].push(version);
            } else {
                acc[prefix] = [version];
            }

            return acc;
        }, {} as { [key: string]: string[] });

        info(`Status: ${status}`);
        info(`Tags: ${JSON.stringify(tags, null, 2)}`);

        setOutput("tags", tags);
    } catch (error) {
        setFailed(error.message);
    }
}

getTags();