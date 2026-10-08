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
	game._on_agent_isles_message([JSON.stringify({"source":"agent-isles-host","version":2,"type":"world:init","payload":{"locale":"en","panelOpen":true,"reducedMotion":true,"residents":[{"id":"coder","status":"approval"}]}})])
	check(game.agent_isles_panel_open and not game.nature_motion and not game.camera_motion, "panel blocks world input and reduced motion applies")
	check(game.creation_workshop.labels[0].text.contains("Aqi"), "English labels")
	check(not game.sanctuary_computer.visible and not game.sanctuary_computer.active, "old transport removed from main flow")
	var slots: Array = [null,null,{"title":"保存的中文标题","versionId":"v1"},null,null,null]
	game._on_agent_isles_message([JSON.stringify({"source":"agent-isles-host","version":2,"type":"project:showcase","payload":slots})])
	check(game.creation_showcase.labels[2].text.contains("保存的中文标题"), "gallery reflects saved version title")
	quit(1 if failed else 0)
