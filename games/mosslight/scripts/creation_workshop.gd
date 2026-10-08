extends Node3D
## Creation Island original procedural characters and props; shared island layout remains upstream MIT.
const FONT = preload("res://assets/fonts/MosslightUI.ttf")
var places: Array[StaticBody3D] = []
var labels: Array[Label3D] = []
var lamp: MeshInstance3D
var vane: Node3D
var clock := 0.0
var working := false

func box(parent: Node3D, position: Vector3, size: Vector3, color: String, rounded: bool = false) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	if rounded:
		var mesh := SphereMesh.new()
		mesh.radius = .5
		mesh.height = 1
		mesh.radial_segments = 12
		mesh.rings = 6
		node.mesh = mesh
		node.scale = size
	else:
		var mesh := BoxMesh.new()
		mesh.size = size
		node.mesh = mesh
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(color)
	material.roughness = .85
	node.material_override = material
	parent.add_child(node)
	node.position = position
	return node

func person(parent: Node3D, role: String) -> void:
	var color := "718268" if role == "teacher" else "75949d"
	box(parent, Vector3(0, .73, 0), Vector3(.70, 1.15, .5), color, true)
	box(parent, Vector3(0, 1.5, 0), Vector3(.6, .66, .57), "e8c8a7", true)
	for x in [-.17, .17]:
		box(parent, Vector3(x, .17, 0), Vector3(.22, .36, .32), "24352f")
		box(parent, Vector3(x, 1.53, .28), Vector3(.065, .075, .04), "24352f", true)
	if role == "teacher":
		var hat := box(parent, Vector3(0, 1.87, 0), Vector3(.83, .12, .7), "f7f6f2")
		hat.rotation.z = -.22
		var fold := box(parent, Vector3(.12, 1.99, 0), Vector3(.54, .12, .56), "f7f6f2")
		fold.rotation.z = .32
		for x in [-.16,.16]:
			var page := box(parent, Vector3(x, .93, .42), Vector3(.32, .43, .08), "f7f6f2")
			page.rotation.y = -.3 if x < 0 else .3
		box(parent, Vector3(0,.92,.49), Vector3(.03,.43,.02), "c86b42")
	else:
		box(parent, Vector3(0, 1.84, 0), Vector3(.72,.18,.64), color, true)
		var strap := box(parent, Vector3(.06,.91,.29), Vector3(.1,.88,.07), "e6ddc7")
		strap.rotation.z = .65
		box(parent, Vector3(.33,.66,.34), Vector3(.48,.40,.18), "e6ddc7")
		box(parent, Vector3(.33,.78,.45), Vector3(.09,.15,.03), "c86b42")

func _ready() -> void:
	var ids := ["coder", "teacher", "file_keeper", "coordinator"]
	var positions := [Vector3(1.2,1.55,-6.8),Vector3(-4.25,.06,-4.5),Vector3(6.6,.06,2.9),Vector3(-3,.06,3)]
	for i in range(4):
		var body := StaticBody3D.new()
		body.position = positions[i]
		body.set_meta("resident", ids[i])
		var collision := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = Vector3(1.8,2.5,1.5)
		collision.shape = shape
		collision.position.y = 1.1
		body.add_child(collision)
		add_child(body)
		body.input_event.connect(func(_camera: Node, event: InputEvent, _pos: Vector3, _normal: Vector3, _shape: int):
			if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT and not get_parent().agent_isles_panel_open:
				get_parent()._emit_agent_isles("resident:selected", {"residentId": body.get_meta("resident")})
		)
		places.append(body)
		var label := Label3D.new()
		label.font = FONT
		label.position.y = 2.8
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.font_size = 32
		label.pixel_size = .008
		label.outline_size = 8
		body.add_child(label)
		labels.append(label)
		if i in [1,2]: person(body,ids[i])
		if i == 0:
			box(body,Vector3(0,.5,0),Vector3(2.6,.16,1.45),"b9a382")
			for x in [-1,1]: box(body,Vector3(x,.2,0),Vector3(.15,.6,1.1),"22675b")
			box(body,Vector3(0,1.1,0),Vector3(.85,.95,.66),"f7f6f2",true)
			box(body,Vector3(0,1.83,0),Vector3(1.13,.86,.77),"f7f6f2",true)
			box(body,Vector3(0,1.85,.38),Vector3(.80,.43,.065),"22675b")
			for x in [-.2,.2]: box(body,Vector3(x,1.9,.43),Vector3(.095,.10,.03),"fff3b5",true)
			box(body,Vector3(.55,.98,.1),Vector3(.36,.43,.3),"c86b42")
			for x in [-.56,.56]: box(body,Vector3(x,1.28,0),Vector3(.25,.46,.30),"f7f6f2",true)
			box(body,Vector3(0,2.31,0),Vector3(.06,.35,.06),"24352f")
			vane = box(body,Vector3(.18,2.46,0),Vector3(.44,.13,.15),"c86b42")
			lamp = box(body,Vector3(-.94,.70,.35),Vector3(.20,.24,.20),"75949d",true)
		if i == 1:
			box(body,Vector3(-1,.6,0),Vector3(.9,1.2,.55),"718268")
			for y in [.25,.55,.85]: box(body,Vector3(-1,y,.3),Vector3(.76,.1,.18),"f7f6f2")
		if i == 2:
			box(body,Vector3(1,.6,0),Vector3(.72,1.2,.10),"e6ddc7")
			for y in [.35,.6,.85]: box(body,Vector3(1,y,.07),Vector3(.48,.04,.02),"22675b")
		if i == 3:
			box(body,Vector3(0,.5,0),Vector3(.15,1,.15),"b9a382")
			var board := box(body,Vector3(0,1.25,0),Vector3(1.3,.95,.15),"718268")
			board.rotation.x = -.2
			for x in [-.32,.32]: box(body,Vector3(x,1.28,.12),Vector3(.50,.65,.02),"f7f6f2")
	refresh_locale()

func refresh_locale() -> void:
	var keys := ["creation.aqi", "creation.shiye", "creation.adu", "creation.inspiration"]
	for i in range(labels.size()): labels[i].text = tr(keys[i])

func set_status(status: String) -> void:
	working = status in ["working","thinking"]
	(lamp.material_override as StandardMaterial3D).albedo_color = Color("c86b42" if status == "approval" else "f4d989" if working else "75949d")
	labels[0].text = tr("creation.aqi") + ("\n" + tr("resident.status." + status) if status in ["working","thinking","approval","failed"] else "")

func advance(delta: float, motion: bool) -> void:
	if motion:
		clock += delta
		vane.rotation.y = sin(clock) * .2
		lamp.scale = Vector3.ONE * (1 + .08 * sin(clock * 3)) if working else Vector3.ONE

func interact(position: Vector3) -> bool:
	for place in places:
		if position.distance_to(place.global_position) < 2.4:
			get_parent()._emit_agent_isles("resident:selected", {"residentId": place.get_meta("resident")})
			return true
	return false
