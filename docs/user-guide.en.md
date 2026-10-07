# Creation Island user guide

Creation Island runs on macOS Apple Silicon. Extract the release folder, keep its contents together, and open `Creation Island.app`. The ◒ menu bar item reopens the interface or stops the service. This development candidate is not notarized; macOS may require allowing it in System Settings on first launch.

## Make your first work

1. Play a quiz, card or branching story in Inspiration, then choose Make my version.
2. Edit text and themes. Drafts save automatically; the right panel is playable.
3. For AI, configure your own provider, model and key in Model settings and test the connection. Provider usage charges may apply.
4. Describe the recipient and content. Select a question, section or node for a scoped edit. Review the proposed work and actual changes, then adopt or discard.
5. Save a version to create a recoverable snapshot. Island displays reference saved versions.
6. Export playable HTML for an offline desktop browser. Back up an editable work package to import and revise later.

Incomplete answers or invalid story paths show validation details and retain the previous valid preview. Complete these fields before saving a version or exporting. Authors should confirm factual model output.

## Storage and recovery

Works, model settings and logs are under `~/Library/Application Support/Creation Island/data`. Exports are in its `exports` subfolder; choose Show in Finder after export. Do not manually edit internal files while the app is running. Use editable packages for work backups.

Continuing from a version restores the draft without deleting history. Deleted works first enter the recycle bin; permanent deletion is irreversible. Interrupted generation does not automatically resume or charge again after restart. Editing during generation invalidates the older proposal.

Fixed navigation remains available if the world fails to load. Light view disables the 3D background. Motion follows system preferences; each player also provides a Reduce motion control.

## Scope

Three interactive work types and three themes are supported. Arbitrary code generation, hosted sharing links, cloud accounts and multiplayer communities are outside this release. See progress and acceptance records for the distinction between implemented and verified features.
