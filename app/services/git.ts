import fs, { promises as fsp } from 'fs';
import pathlib from 'path';
import git, { ReadCommitResult } from 'isomorphic-git';
import elog from 'electron-log';

export const log = elog.scope('services/git');

interface GitStatus {
  modified: number;
  created: number;
  inGit: boolean;
  uncommittedChanges: boolean;
}
const adjustStatusTimestamps = (
  status: GitStatus,
  commit: ReadCommitResult
) => {
  const commitTimestamp = commit.commit.committer.timestamp * 1000;
  if (status.modified < 0 || status.modified < commitTimestamp) {
    // eslint-disable-next-line no-param-reassign
    status.modified = commitTimestamp;
  }
  if (status.created < 0 || status.created > commitTimestamp) {
    // eslint-disable-next-line no-param-reassign
    status.created = commitTimestamp;
  }
};
//  Get git status, including created and modified timestamps.
export const getGitStatus = async (
  path: string,
  gitDir: string
): Promise<GitStatus> => {
  log.info(`Looking for timestamps of ${path} at ${gitDir}`);
  const commits = await git.log({ fs, dir: gitDir });
  let lastSHA = null;
  let lastCommit = null;
  const statusResult = {
    modified: -1,
    created: -1,
    inGit: true,
    uncommittedChanges: false
  };
  for (let i = 0; i < commits.length; i += 1) {
    const commit = commits[i];
    try {
      // eslint-disable-next-line no-await-in-loop
      const o = await git.readObject({
        fs,
        dir: gitDir,
        oid: commit.oid,
        filepath: path
      });
      log.info(
        `Found file in git commit at ${new Date(
          commit.commit.committer.timestamp * 1000
        )}`
      );
      if (i === commits.length - 1) {
        // file already existed in first commit
        adjustStatusTimestamps(statusResult, commit);
        break;
      }
      if (o.oid !== lastSHA) {
        if (lastCommit !== null) {
          adjustStatusTimestamps(statusResult, lastCommit);
        }
        lastSHA = o.oid;
      }
    } catch (err) {
      // File no longer there, or wasn't in git at all
      // If not in git at all, then lastCommit is null
      if (lastCommit != null) {
        adjustStatusTimestamps(statusResult, lastCommit);
      }
      break;
    }
    lastCommit = commit;
  }
  // File is not in git
  if (statusResult.modified < 0) {
    log.info('No commits found');
    const stat = await fsp.stat(pathlib.join(gitDir, path));
    return {
      modified: stat.mtimeMs,
      created: stat.birthtimeMs,
      inGit: false,
      uncommittedChanges: true // The existence of the file is an uncommitted change
    };
  }
  const status = await git.status({ fs, dir: gitDir, filepath: path });
  // File has not been modified since checkout
  if (status !== 'unmodified') {
    log.info('File has been modified since checkout');
    statusResult.uncommittedChanges = true;
    const stat = await fsp.stat(pathlib.join(gitDir, path));
    statusResult.modified = stat.mtimeMs;
  }
  return statusResult;
};
