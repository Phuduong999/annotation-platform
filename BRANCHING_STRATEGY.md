# Branching Strategy

## Overview
This project follows a professional Git branching strategy to ensure code quality and stable releases.

## Branch Structure

### `production`
- **Purpose**: Production-ready code that is deployed to live environment
- **Stability**: Highest - only thoroughly tested and approved code
- **Deployment**: Automatic deployment to production environment
- **Protection**:
  - Requires pull request reviews
  - Must pass all CI/CD checks
  - No direct commits allowed

### `main`
- **Purpose**: Staging/pre-production environment
- **Stability**: High - tested features ready for final validation
- **Deployment**: Automatic deployment to staging environment
- **Protection**:
  - Requires pull request from `dev`
  - Must pass all tests
  - Code review recommended

### `dev`
- **Purpose**: Active development and integration
- **Stability**: Medium - latest features under development
- **Usage**: All feature branches merge here first
- **Testing**: Continuous integration testing

### Feature Branches
- **Naming**: `feature/feature-name` or `feat/feature-name`
- **Purpose**: Individual feature development
- **Base**: Created from `dev`
- **Merge**: Back to `dev` via pull request

### Bugfix Branches
- **Naming**: `bugfix/bug-name` or `fix/bug-name`
- **Purpose**: Bug fixes for development
- **Base**: Created from `dev`
- **Merge**: Back to `dev` via pull request

### Hotfix Branches
- **Naming**: `hotfix/issue-name`
- **Purpose**: Critical production bug fixes
- **Base**: Created from `production`
- **Merge**: To both `production` AND `main` AND `dev`

## Workflow

### Feature Development
```bash
# Create feature branch from dev
git checkout dev
git pull origin dev
git checkout -b feature/your-feature-name

# Work on feature, commit changes
git add .
git commit -m "feat: add your feature"

# Push and create PR to dev
git push -u origin feature/your-feature-name
```

### Release to Staging (main)
```bash
# Merge dev to main via PR
# After approval and CI passes
git checkout main
git pull origin main
git merge dev
git push origin main
```

### Release to Production
```bash
# Merge main to production via PR
# After thorough testing on staging
git checkout production
git pull origin production
git merge main
git push origin production
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### Hotfix Process
```bash
# Create hotfix from production
git checkout production
git pull origin production
git checkout -b hotfix/critical-bug

# Fix the bug
git add .
git commit -m "hotfix: fix critical bug"

# Merge to production
git checkout production
git merge hotfix/critical-bug
git push origin production

# Also merge to main
git checkout main
git merge hotfix/critical-bug
git push origin main

# Also merge to dev
git checkout dev
git merge hotfix/critical-bug
git push origin dev

# Tag the hotfix release
git tag -a v1.0.1 -m "Hotfix version 1.0.1"
git push origin v1.0.1

# Delete hotfix branch
git branch -d hotfix/critical-bug
git push origin --delete hotfix/critical-bug
```

## Commit Message Convention

Follow conventional commits for clear history:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

**Examples:**
```
feat: add user authentication
fix: resolve annotation save issue
docs: update API documentation
refactor: improve task service performance
```

## Pull Request Process

1. **Create PR** from feature/bugfix branch to `dev`
2. **Description** should include:
   - What was changed and why
   - How to test the changes
   - Screenshots (if UI changes)
3. **Review** by at least one team member
4. **Tests** must pass
5. **Merge** after approval

## Best Practices

1. **Keep branches updated**: Regularly pull from base branch
2. **Small commits**: Make focused, atomic commits
3. **Descriptive messages**: Write clear commit messages
4. **Delete merged branches**: Clean up after merging
5. **Test before PR**: Run tests locally before creating PR
6. **Review thoroughly**: Take time to review code changes
7. **Never force push** to `main` or `production`

## Environment Mapping

| Branch | Environment | URL |
|--------|-------------|-----|
| `production` | Production | https://app.yourcompany.com |
| `main` | Staging | https://staging.yourcompany.com |
| `dev` | Development | https://dev.yourcompany.com |

## Quick Reference

```bash
# Start new feature
git checkout dev && git pull && git checkout -b feature/name

# Update feature with latest dev
git checkout dev && git pull && git checkout feature/name && git merge dev

# Switch to dev and update
git checkout dev && git pull origin dev

# View all branches
git branch -a

# Delete local branch
git branch -d branch-name

# Delete remote branch
git push origin --delete branch-name
```
