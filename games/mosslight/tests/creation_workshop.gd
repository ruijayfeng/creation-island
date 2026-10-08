extends SceneTree
var failed := false
func _initialize() -> void:
	call_deferred("run")
func check(ok: bool, label: String) -> void:
	print("PASS " if ok else "FAIL ", label)
	failed = failed or not ok
func run() -> void:
	var game = load("res://scenes/island.tscn").instantiate()
	root.add_child(game)
	await process_frame
	await process_frame
	check(game.creation_workshop.places.size() == 4, "three characters and inspiration board")
	print("LABELS ", game.creation_workshop.labels.map(func(label): return label.text))
	check(game.creation_workshop.labels[0].text.contains("阿启"), "localized functional label")
	game._on_agent_isles_message([JSON.stringify({"source":"agent-isles-host","version":4,"type":"world:init","payload":{"locale":"en","panelOpen":true,"reducedMotion":true,"residents":[{"id":"coder","status":"approval"}]}})])
	check(game.agent_isles_panel_open and not game.nature_motion and not game.camera_motion, "panel blocks world input and reduced motion applies")
	check(game.creation_workshop.labels[0].text.contains("Aqi"), "English labels")
	check(not game.sanctuary_computer.visible and not game.sanctuary_computer.active, "old transport removed from main flow")
	var original_pose: Transform3D = game.camera.global_transform
	var original_size: float = game.camera.size
	var cue := {"source":"agent-isles-host","version":4,"type":"world:init","payload":{"panelOpen":true,"reducedMotion":false,"attention":{"target":"teacher","layout":"encounter","sideRatio":.4}}}
	game._on_agent_isles_message([JSON.stringify(cue)])
	game._update_creation_attention(1.0)
	check(not game.camera.global_transform.is_equal_approx(original_pose), "role interaction focuses its actual place")
	cue.payload.panelOpen = false
	game._on_agent_isles_message([JSON.stringify(cue)])
	game._update_creation_attention(1.0)
	check(game.camera.global_transform.is_equal_approx(original_pose) and is_equal_approx(game.camera.size, original_size), "closing interaction restores the previous camera")
	cue.payload.panelOpen = true
	cue.payload.reducedMotion = true
	game._on_agent_isles_message([JSON.stringify(cue)])
	game._update_creation_attention(1.0)
	check(game.camera.global_transform.is_equal_approx(original_pose), "reduced motion leaves camera unchanged")
	cue.payload.attention.sideRatio = 99
	game._on_agent_isles_message([JSON.stringify(cue)])
	check(game.creation_attention.is_empty(), "out-of-range camera cue is ignored")
	var slots: Array = [null,null,{"title":"保存的中文标题","versionId":"v1"},null,null,null]
	game._on_agent_isles_message([JSON.stringify({"source":"agent-isles-host","version":4,"type":"project:showcase","payload":slots})])
	check(game.creation_showcase.labels[2].text.contains("保存的中文标题"), "gallery reflects saved version title")
	# Synthetic texture fixture, never presented as an achievement screenshot.
	var image := Image.create(640, 360, false, Image.FORMAT_RGB8)
	image.fill(Color("22675b"))
	slots[2]["coverPng"] = Marshalls.raw_to_base64(image.save_png_to_buffer())
	game.creation_showcase.update_slots(slots)
	check(game.creation_showcase.pictures[2].visible, "bounded PNG decodes into gallery texture")
	slots[2]["coverPng"] = "not-png"
	game.creation_showcase.update_slots(slots)
	check(not game.creation_showcase.pictures[2].visible, "invalid texture clears previous image")
	game.creation_showcase.update_slots([null,null,null,null,null,null])
	check(not game.creation_showcase.pictures[2].visible and not game.creation_showcase.occupied[2], "empty project clears old cover and version")
	quit(1 if failed else 0)
