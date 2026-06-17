# Contributing

This project uses **GitHub Flow**: `main` is always green and shippable, and
every change lands through a short-lived branch and a squash-merged pull request.
Never commit directly to `main`.

## Where to start

| You want to...      | Do this                                     |
| ------------------- | ------------------------------------------- |
| Report a bug        | Open an issue with steps to reproduce       |
| Request a feature   | Open an issue; note if you plan to build it |
| Ask a question      | Open an issue                               |
| Contribute a change | Fork the repo and open a pull request       |

Search existing issues before opening a new one, and for anything non-trivial,
agree on the approach in an issue before writing code.

## Pull request process

1. Fork the repo and clone your fork, then add this repo as `upstream`:
   `git remote add upstream https://github.com/ParkerCai/parallel-ai-extension.git`
   (Maintainers with write access can skip the fork and branch directly here.)
2. Branch off an up-to-date `main`:
   `git switch main && git pull upstream main && git switch -c feat/short-description`
3. Make focused commits; keep the PR small and to one change.
4. Make sure the suite passes locally: `bun run test`.
5. Push to your fork and open a PR against `main`. Get CI green; a maintainer
   will review.
6. Once approved and CI is green, a maintainer **squash-merges** it.

> Squash-and-merge is a maintainer responsibility. Please don't merge your own
> PR; leave it for a maintainer once it's approved.

After it lands, sync your fork and remove your local branch:
`git switch main && git pull upstream main && git branch -D feat/short-description`

Branch names: `feat/`, `fix/`, `chore/`, or `docs/` plus a short description.

## Commit messages

Use Conventional Commits. The squash title becomes the changelog line:

```text
type(scope): short description
```

| `type`     | When to use                                               |
| ------------ | --------------------------------------------------------- |
| `feat`     | A new feature                                             |
| `fix`      | A bug fix                                                 |
| `docs`     | Documentation-only changes                                |
| `refactor` | A code change that neither fixes a bug nor adds a feature |
| `perf`     | A code change that improves performance                   |
| `test`     | Changes that only affect tests                            |
| `deps`     | Dependency-only updates                                   |
| `chore`    | Build process, tooling, or auxiliary changes              |

Scope is the area touched, e.g. `feat(onboarding):`, `fix(composer):`,
`chore(release):`. Append `!` for a breaking change: `feat(settings)!: ...`.

## PR checklist

- Tests added or updated, and `bun run test` passes
- Self-reviewed the diff
- Breaking changes called out in the description

## Conventions

- Squash-merge only, so `main` stays linear (one commit per PR, no merge commits).
- Never rewrite published history. Do not force-push `main`; fix forward with a new PR.
- Prefer small, frequent PRs. Pull `main` often to keep conflicts small.

## Optional: keep local branch pointers tidy

Branches deleted on the remote (e.g. after a PR merges) linger in your local
view until pruned. Prune on demand any time:

```bash
git fetch --prune
```

If you'd prefer this to happen automatically on every fetch, you can enable it,
but note it's a global Git setting that affects all your repos, so it's a
personal preference:

```bash
git config --global fetch.prune true
```

## Maintainer setup (once)

In repo Settings, allow squash merging only (disable merge and rebase merging),
enable "Automatically delete head branches", and protect `main` to require a
pull request and a passing CI check before merge.

Keep the repo clean and organized, and leave the code a little better than you found it.

By contributing, you agree that your contributions are licensed under the
project's [LICENSE](LICENSE).
