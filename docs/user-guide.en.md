# Creation Island guide

Creation Island 0.2.0 runs on Apple Silicon macOS. Keep the extracted folder together and open `Creation Island.app`. Use its menu bar icon to reopen or quit. This candidate has no Apple Developer signature or notarization.

## Create on the island

1. Click Aqi or “Aqi · Create”. Name a project, enter an idea, create its separate directory, then send the request. Shiye can open an existing folder through the picker or an absolute path. Opening never installs dependencies or runs commands.
2. Configure your provider in Model settings. The native composer supports attachments, models and permissions. New sessions default to workspace write with approval when required; existing sessions retain their actual permissions.
3. Aqi changes real files. Review each requested command and scope before allowing or denying it. Closing, returning or focusing only changes layout; “Stop turn” cancels. Only one turn runs at a time, without a cross-project queue.
4. Preview lists detected static directories or Node scripts. Confirm a command to start it; the host verifies HTTP access. Reachability does not prove functionality, so try the result. Continue the same conversation below the preview to request changes.
5. Adu shows files and actual changes. Save an achievement when satisfied, describing requirements, then select one of six display slots. Finishing a turn does not save an achievement.
6. Review the saved file list and exclusions before exporting source. A successful build enables static export. Single HTML export requires a conservative self-containment check.

## History and delivery

Achievements are immutable snapshots. Historical previews run separate copies of their saved version. Restore creates a new project directory, preserving the original files, Git history and uncommitted work. Opening conversations, switching projects and restarting never sends a request automatically. Interrupted work needs an explicit continuation.

Source archives contain `project/`, a hash manifest and running instructions. Git history, dependency caches, recognized credentials and symbolic links are excluded. Saving stops above 64 MiB per file, 1 GiB total or 50,000 entries. Review exports: exclusion rules cannot identify every private file.

Node preview scripts and dependency installation/build are explicit approvals to execute local code; inspect the scripts. Builds run in a separate achievement copy. Other stacks require their own environment. Public deployment is not included. Downloads use your browser; internal data defaults to `~/Library/Application Support/Creation Island/data`.

Previews use a different local origin from the host, without host cookies or access to the world bridge. Browser storage belongs to that preview origin and is not a reliable backup. Starting a new preview changes its port, so stored browser data may not appear in the new origin.

## Access and compatibility

Characters, shortcuts and nearby interactions open the same panels without waiting for movement or a story. Esc closes panels. Keyboard shortcuts, narrow layouts, light mode and reduced motion are available. Shortcut buttons remain usable when the world fails to load; find light mode under “?”.

Legacy interactive works keep the original quiz, card and branching story data and export format. They are not automatically converted. The advanced workbench is optional.

Bundled Node/npm and the pinned runtime start the app and static projects. Framework dependencies, model accounts and system tools depend on the project. The runtime requires macOS 13.5 or later; consult the open-project acceptance record for tested environments and cross-device limitations.
