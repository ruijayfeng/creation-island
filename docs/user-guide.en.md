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

## Island interaction changes in current source (pending review)

The current source has no permanent row of feature tabs. Click a character or use the collapsible **Island map**. Aqi opens making, Shiye opens the project book, and Adu opens changes and delivery. The introductory note can be dismissed. These changes are absent from the 0.2.0 package.

Tell Aqi your idea first. A project name is optional; without one, the first line supplies a short name. Creating the folder keeps the idea ready for you to send. In a project, **Try this version** is the primary action; notes, files and other actions expand when needed. **I’d like a change** opens the same native conversation beside the preview. Main preview actions remain visible. Permissions, attachments, model choice and actual approvals remain in the native interface.

Shiye lists projects first, with the current project at the top. The project book contains saved notes, versions and earlier conversations. Adu explains current changes before showing files or saved-version exports. Other export formats, build commands and detailed manifests expand separately. The coast shows the selected saved version; historical iteration creates a separate copy.

Inspiration shows one playable example at a time. Turn pages, try an example, then copy it without automatically calling a model. Screenshot feedback explains marking and describing changes, and explicitly says when only text is sent. Settings and language are under the top-right gear. Focus mode is optional; closing restores the island view without stopping work. Reduced motion leaves the camera unchanged.

## New source features (pending acceptance; absent from the 0.2.0 package)

Inspiration now offers four playable static starters. Play one, then name and copy its real files into your own project. Copying does not call a model. Cancel the selection before copying; once accepted, copying finishes even if you leave, and the project remains with Shiye. Demo browser storage is not copied with source files.

Project notes hold goals, decisions and tasks. Enabling context applies the saved revision to the next turn. Notes are user data, never permission changes, and disabling does not erase conversation history. Clear input and save to clear notes; compare the latest revision after a save conflict. Achievements freeze their notes, which can be explicitly included in source or static exports.

Capture a preview or upload/paste a screenshot to add numbered text, crop, redact, undo/redo and zoom. Built-in capture requires Region Capture support and manual permission to share this tab; it can be cancelled. Frames are encoded only after successful preview cropping. Cancellation or failure saves no frame. Unsaved editing lasts for this visit; explicitly saved feedback drafts recover after restart and never auto-send. Text-only submission is the default. Attach an image only after confirming model image support; text feedback does not demonstrate image understanding.

For historical screenshots, choose the current project or restore a separate copy first. Covers require a verifiable static saved-version preview, origin checks around capture and user confirmation. Node previews, unsupported capture and failed origin checks retain file icons. Replace, swap or remove references in six gallery slots without changing immutable achievements. Actual model image input, system-browser capture compatibility and the new desktop package remain unverified.
