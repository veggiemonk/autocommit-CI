const path = require('path');
// const { promisify } = require('util');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const dayjs = require('dayjs');

require('draftlog').into(console);

process.on('unhandledRejection', error => {
  console.log('unhandledRejection', error.message);
});

if (!process.env.TOKEN) {
  console.log('❌  no credentials found.');
  process.exit(1);
}

const homeDir = process.env.PWD;

console.log({homeDir})

// --- ENV VAR ---
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 10;
const DELAY = parseInt(process.env.DELAY, 10) || 3000;
// --- FILENAME ---
const README = 'README.md';
const GITHUB_METADATA_FILE = `data/${dayjs().format('YYYY-MM-DDTHH.mm.ss')}-fetched_repo_data.json`;
const LATEST_FILENAME = path.join(homeDir, 'data/latest');
const GITHUB_REPOS = path.join(homeDir,'data/list_repos.json');
// --- HTTP ---
const API = 'https://api.github.com/';
const options = {
  method: 'GET',
  headers: {
    'User-Agent': 'awesome-docker script listing',
    'Content-Type': 'application/json',
    Authorization: `token ${process.env.TOKEN}`,
  },
};

const removeHost = x => x.slice('https://github.com/'.length, x.length);
// const readFile = promisify(fs.readFile);
// const writeFile = promisify(fs.writeFile);
const barLine = console.draft('Starting batch...');
const handleFailure = err => {
  if (err) console.error('❌ ERROR', err);
  process.exit(1);
};

const delay = ms =>
  new Promise(resolve => {
    setTimeout(() => resolve(), ms);
  });

const get = (path, opt) =>
  fetch(`${API}repos/${path}`, {
    ...options,
    ...opt,
  })
    .catch(handleFailure)
    .then(response => {
      if (response.ok) return response.json();
      throw new Error('Network response was not ok.');
    })
    .catch(handleFailure);

const fetchAll = batch => Promise.all(batch.map(async path => get(path)));

const extractAllRepos = markdown => {
  const re = /https:\/\/github\.com\/([a-zA-Z0-9-._]+)\/([a-zA-Z0-9-._]+)/g;
  const md = markdown.match(re);
  return [...new Set(md)];
};

const ProgressBar = (i, batchSize, total) => {
  const progress = Math.round((i / total) * 100);
  const units = Math.round(progress / 2);
  return barLine(
    `[${'='.repeat(units)}${' '.repeat(50 - units)}] ${progress}%  -  # ${i}`,
  );
};

async function batchFetchRepoMetadata(githubRepos) {
  const repos = githubRepos.map(removeHost);

  const metadata = [];
  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < repos.length; i += BATCH_SIZE) {
    const batch = repos.slice(i, i + BATCH_SIZE);
    if (process.env.DEBUG) console.log({ batch });
    const res = await fetchAll(batch);
    metadata.push(...res);
    ProgressBar(i, BATCH_SIZE, repos.length);
    // poor man's rate limiting so github don't ban us
    await delay(DELAY);
  }
  ProgressBar(repos.length, BATCH_SIZE, repos.length);
  return metadata;
}

function shouldUpdate(fileLatestUpdate) {
  if (!fileLatestUpdate) return true;

  const hours = fileLatestUpdate.slice(
    'data/YYYY-MM-DDT'.length,
    'data/YYYY-MM-DDTHH'.length,
  );
  const latestUpdate = dayjs(
    fileLatestUpdate.slice('data/'.length, 'data/YYYY-MM-DD'.length),
  ).add(hours, 'hour');
  const isMoreThanOneDay = dayjs().diff(latestUpdate, 'hours') >= 1;
  return isMoreThanOneDay;
}

async function main() {
  try {
    const getLatest = await fs.readFile(LATEST_FILENAME, {
      encoding: 'utf8',
    })
    if (!shouldUpdate(getLatest)) {
      console.log('Last update was less than a day ago 😅. Exiting...');
      process.exit(1);
    }

    const githubRepos = [
      'https://github.com/veggiemonk/awesome-docker',
      'https://github.com/kubernetes/kubernetes',
      'https://github.com/weaveworks/weave',
      'https://github.com/sindresorhus/awesome',
      'https://github.com/ashmckenzie/percheron',
    ];
    await fs.writeFile(
      GITHUB_REPOS,
      JSON.stringify(githubRepos, null, 2),
      handleFailure,
    );

    const metadata = await batchFetchRepoMetadata(githubRepos);

    console.log('writing metadata to disk...')
    await fs.writeFile(
      GITHUB_METADATA_FILE,
      JSON.stringify(metadata, null, 2),
      handleFailure,
    );
    console.log('✅ metadata saved');

    console.log('removing latest...')
    await fs.remove(LATEST_FILENAME);

    console.log('writing latest...');
    await fs.writeFile(LATEST_FILENAME, GITHUB_METADATA_FILE, 'utf8', handleFailure);

    console.log('✅ late update time saved', LATEST_FILENAME, GITHUB_METADATA_FILE);

    console.log('gracefully shutting down.');
    process.exit();

  } catch (err) {
    handleFailure(err);
  }
}

main();
