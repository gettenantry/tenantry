# Going-public checklist

Reference document — **do not execute before v2 is stable**. Work through it top to bottom on the day the repository goes public.

## 0. Release prerequisites (before flipping visibility)

- [ ] v1 (`@tenantry/core`, `@tenantry/prisma`) published on npm and battle-tested in a real project
- [ ] v2 (`@tenantry/typeorm`) published on npm (milestone [v2.0](https://github.com/gettenantry/tenantry/milestone/2) complete)
- [ ] Test coverage still ≥ 90% on every published package (CI enforces it — just confirm no gate was loosened)
- [ ] Documentation site complete and navigable (`pnpm --filter @tenantry/docs build` green)
- [ ] `git log` audit: history clean, no secrets, no personal information beyond the devanonyme42 identity

npm publishing reminders (from the v1 release, kept here for v2):

- [ ] npm org `tenantry` exists and owns the `@tenantry` scope
- [ ] First publish of any NEW package is manual (`pnpm release` locally) — trusted publishing cannot create a package
- [ ] Trusted publisher (repo `gettenantry/tenantry`, workflow `release.yml`) configured on every package on npmjs.com
- [ ] `"private": true` removed from any package meant to be published

## 1. Flip visibility

- [ ] `gh repo edit gettenantry/tenantry --visibility public --accept-visibility-change-consequences`

## 2. Immediately after (features unavailable on private/free)

- [ ] **GitHub Pages**: repo Settings → Pages → source **GitHub Actions**, then re-run the Docs workflow → site live at <https://gettenantry.github.io/tenantry/>
- [ ] **Branch protection** on `main` (fails with 403 while private on the free plan):

  ```sh
  gh api -X PUT repos/gettenantry/tenantry/branches/main/protection --input - <<'EOF'
  {
    "required_status_checks": {
      "strict": true,
      "checks": [
        {"context": "Lint, test & build (Node 22)"},
        {"context": "Lint, test & build (Node 24)"},
        {"context": "Integration tests (PostgreSQL via Testcontainers)"}
      ]
    },
    "enforce_admins": false,
    "required_pull_request_reviews": {"required_approving_review_count": 1},
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false,
    "required_conversation_resolution": true
  }
  EOF
  ```

- [ ] **CodeQL**: verify the first real analysis runs green (the workflow un-gates automatically; check the Security tab)
- [ ] **Codecov**: add the `CODECOV_TOKEN` secret if not done, flip `fail_ci_if_error: true` in `ci.yml`, confirm the upload
- [ ] Enable **GitHub Discussions** (Settings → Features) and seed a welcome post
- [ ] Repo topics: `nestjs`, `multi-tenancy`, `prisma`, `typeorm`, `row-level-security`, `postgresql`, `saas`

## 3. README polish

- [ ] Uncomment the npm version/downloads and Codecov badges (HTML comment at the top of README.md)
- [ ] Add the Pages URL as the repo website + replace intra-repo docs links with the live site
- [ ] Add the Sponsors badge once sponsoring is live (below)

## 4. Sponsoring

- [ ] Enable GitHub Sponsors for the `gettenantry` org (or the maintainer account)
- [ ] Create `.github/FUNDING.yml` (deliberately NOT created while private):

  ```yaml
  github: [devanonyme42]
  # open_collective: tenantry   # if/when created
  ```

- [ ] Fill the "Sponsors" section of README.md

## 5. Announcements (prepare the texts BEFORE flipping visibility)

- [ ] "Show HN" post — lead with the deliberate-bug isolation test, not the feature list
- [ ] Reddit r/node and r/typescript (adapted tone, code-first)
- [ ] Dev.to article — the "why RLS + Prisma" story, linking the integration suite
- [ ] Twitter/X thread
- [ ] Submit to [Awesome NestJS](https://github.com/nestjs/awesome-nestjs) (PR adding Tenantry)
- [ ] Open the v3 direction issue for votes ([#16](https://github.com/gettenantry/tenantry/issues/16) — pin it)

## 6. Watch for the first 72 hours

- [ ] Issues/Discussions triage twice a day (first impressions decide adoption)
- [ ] CI stays green on community PRs (fork PRs get read-only tokens — expect Codecov upload skips)
- [ ] Security advisories channel monitored (SECURITY.md points to private reporting)
