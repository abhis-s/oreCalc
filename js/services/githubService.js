import { formatDate } from '../utils/dateFormatter.js';

export async function fetchChangelog() {
    try {
        const response = await fetch('https://api.github.com/repos/abhis-s/oreCalc/commits');
        if (!response.ok) {
            throw new Error(`GitHub API request failed with status ${response.status}`);
        }
        const commits = await response.json();

        const commitsByDate = commits.slice(0, 10).reduce((acc, commit) => {
            const commitDate = new Date(commit.commit.author.date);
            const formattedDate = formatDate(commitDate, { year: 'numeric', month: 'long', day: 'numeric' });
            if (!acc[formattedDate]) {
                acc[formattedDate] = [];
            }
            const message = commit.commit.message.split('\n')[0].replace(/\s\(#\d+\)$/, '');
            acc[formattedDate].push(message);
            return acc;
        }, {});

        let changelogHtml = '';
        let isFirst = true;
        for (const date in commitsByDate) {
            if (isFirst) {
                changelogHtml += `<div class="changelog-group-latest">`;
                isFirst = false;
            } else {
                changelogHtml += `<div>`;
            }
            changelogHtml += `<h3>${date}</h3>`;
            changelogHtml += '<ul>';
            commitsByDate[date].forEach(message => {
                changelogHtml += `<li>${message}</li>`;
            });
            changelogHtml += '</ul>';
            changelogHtml += `</div>`;
        }

        return changelogHtml;
    } catch (error) {
        console.error('Failed to fetch changelog:', error);
        return '<p>Could not fetch changelog.</p>';
    }
}