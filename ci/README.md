# CI templates

Copy these into `.github/workflows/` to enable CI and the GitHub Pages deploy.
They live here because the GitHub CLI token used to publish this repo has no `workflow` scope;
run `gh auth refresh -h github.com -s workflow` and then `mkdir -p .github && git mv ci .github/workflows`.

- `ci.yml`: lints the contract, runs the Direct Mode tests, typechecks, tests and builds the web app.
- `pages.yml`: builds the web app and publishes it to GitHub Pages; set the repository variable `INQUEST_CONTRACT` to the deployed contract address.
