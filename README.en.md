# Creation Island

Creation Island is an open AI project environment centered on a 3D island. Work with Aqi at the making table, find projects and conversations with Shiye, and inspect files, changes and delivery with Adu. Websites, interactive tools, lightweight Web games and existing project edits are the initial focus; other stacks depend on the actual environment.

**Version 0.2.0 is a development candidate.** The new workflow is implemented and has passed local concentrated checks. See [progress](docs/progress.md) and [open-project acceptance](docs/open-project-acceptance.md) for delivery and unverified scope. Legacy structured creations retain their data and access; their historical results do not validate the new workflow.

## Use and development

The Apple Silicon desktop bundle includes Node/npm, the pinned Harness runtime and island assets. Configure your own model provider. See the [English guide](docs/user-guide.en.md) / [中文说明](docs/user-guide.md).

Development requires Node.js `^22.19.0` or `>=24.0.0` and Corepack Yarn `4.18.0`:

```sh
corepack yarn install --immutable
corepack yarn build:world  # Godot 4.7.2 + Web export templates
corepack yarn dev:web
```

Build the Apple Silicon package with `corepack yarn build:desktop:darwin`. Independently extract it and run `bash apps/desktop/verify-darwin.sh <extracted directory>`. The acceptance record describes open-project checks.

New sessions default to `workspace-write + ask`; existing sessions retain their actual permissions. Models edit real files. Stopping, ending a turn, reaching a preview and saving an achievement are distinct states. Restore creates a copy by default; achievements and exports reference explicit saved versions. Source archives, built static packages and self-contained HTML have different running requirements.

This release does not include public deployment, cloud sync, Apple notarization or one-click support for every stack. Preview and build scripts are explicitly confirmed local code execution. The normal workflow does not require the advanced workbench.

## Documentation and sources

- [Product specification](docs/product-spec.md), [experience](docs/product-experience.md), [characters](docs/brand-and-characters.md)
- [Architecture](docs/architecture.md), [implementation boundaries](docs/implementation-plan.md), [testing](docs/testing-and-release.md)
- [Asset register](docs/asset-register.csv), [source baseline](docs/source-baseline.md), [third-party notices](THIRD_PARTY_NOTICES.en.md)

Repository: [ruijayfeng/creation-island](https://github.com/ruijayfeng/creation-island). The original isles repository is read-only reference material. The pinned Harness and vendor archives remain unchanged. Development conventions are in [AGENTS.md](AGENTS.md).
