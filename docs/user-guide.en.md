# Creation Island user guide

Creation Island runs on macOS Apple Silicon. Extract the release folder, keep its contents together, and open `Creation Island.app`. The ◒ menu bar item reopens the interface or stops the service. This development candidate is not notarized; macOS may require allowing it in System Settings on first launch.

## Make your first work

1. Play a quiz, card or branching story in Inspiration, then choose Make my version.
2. Choose settings, a question, a section or a story node in the outline. Edit one part at a time; drafts save automatically. Switch between Edit and Play in the central workspace.
3. For AI, configure your own provider, model and key in Model settings and test the connection. Provider usage charges may apply.
4. Open Your companion and describe the recipient and content. The outline selection becomes the AI edit scope; you can also select Whole work. Review before/after content and play the proposal, then adopt or discard.
5. Save a version to create a recoverable snapshot. Island displays reference saved versions.
6. Export playable HTML for an offline desktop browser. Choose More actions → Back up editable work to import and revise later.

Incomplete answers or invalid story paths show validation details and retain the previous valid preview. Complete these fields before saving a version or exporting. Authors should confirm factual model output.

If the draft differs from the saved version, explicitly choose Save a new version & export or Export last saved version. Back to editing and Escape do not export. The receipt shows the exported version time.

On narrow windows, switch between Outline, Content & style and Your companion. Story route links navigate directly to their target node.

## Storage and recovery

Works, model settings and logs are under `~/Library/Application Support/Creation Island/data`. Exports are in its `exports` subfolder; choose Show in Finder after export. Do not manually edit internal files while the app is running. Use editable packages for work backups.

Continuing from a version restores the draft without deleting history. Deleted works first enter the recycle bin; permanent deletion is irreversible. Interrupted generation does not automatically resume or charge again after restart. Editing during generation invalidates the older proposal.

Fixed navigation remains available if the world fails to load. Light view disables the 3D background. Motion follows system preferences; each player also provides a Reduce motion control.

## Scope

Three interactive work types and three themes are supported. Arbitrary code generation, hosted sharing links, cloud accounts and multiplayer communities are outside this release. See progress and acceptance records for the distinction between implemented and verified features.

The bundled runtime requires macOS 13.5 or later. This build was tested on macOS 26.5.1 / Apple Silicon; other OS versions have not been verified.
