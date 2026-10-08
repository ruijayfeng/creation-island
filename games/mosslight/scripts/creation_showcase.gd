extends Node3D
## Six reusable pedestals. Host owns the works; the world only projects saved slots.
signal selected(slot: int)
var bodies: Array[StaticBody3D] = []
var labels: Array[Label3D] = []
var materials: Array[StandardMaterial3D] = []
var occupied: Array[bool] = []
var pictures: Array[MeshInstance3D] = []
var picture_hashes: Array[String] = []

func _ready() -> void:
	for i in range(6):
		var body := StaticBody3D.new()
		body.position = Vector3(-5.0 + i * 2.0, 0.35, 8.0)
		var mesh := MeshInstance3D.new()
		var cylinder := CylinderMesh.new()
		cylinder.top_radius = 0.45
		cylinder.bottom_radius = 0.55
		cylinder.height = 0.7
		mesh.mesh = cylinder
		var material := StandardMaterial3D.new()
		material.albedo_color = Color("97ac99")
		mesh.material_override = material
		body.add_child(mesh)
		var collision := CollisionShape3D.new()
		var shape := CylinderShape3D.new()
		shape.radius = 0.55
		shape.height = 0.7
		collision.shape = shape
		body.add_child(collision)
		var label := Label3D.new()
		label.no_depth_test = true
		label.render_priority = 110
		label.font = preload("res://assets/fonts/CreationTitles.ttf")
		label.text = "%02d" % (i + 1)
		label.position.y = 1.5
		var picture := MeshInstance3D.new()
		var quad := QuadMesh.new()
		quad.size = Vector2(1.45, 0.82)
		picture.mesh = quad
		picture.position.y = 0.85
		var picture_material := StandardMaterial3D.new()
		picture_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		picture_material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		picture.material_override = picture_material
		picture.visible = false
		body.add_child(picture)
		pictures.append(picture)
		picture_hashes.append("")
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.font_size = 40
		label.modulate = Color("fff4d4")
		body.add_child(label)
		body.input_event.connect(func(_camera: Node, event: InputEvent, _position: Vector3, _normal: Vector3, _shape: int):
			if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
				selected.emit(i)
		)
		add_child(body)
		bodies.append(body)
		labels.append(label)
		materials.append(material)
		occupied.append(false)

func update_slots(value: Variant) -> void:
	if typeof(value) != TYPE_ARRAY or value.size() != 6:
		return
	for i in range(6):
		var item: Variant = value[i]
		var encoded := ""
		if typeof(item) == TYPE_DICTIONARY and item.get("coverPng") is String:
			encoded = item.coverPng
		if encoded != picture_hashes[i]:
			picture_hashes[i] = encoded
			pictures[i].visible = false
			var pm := pictures[i].material_override as StandardMaterial3D
			pm.albedo_texture = null
			if encoded.begins_with("iVBORw0KGgo") and encoded.length() <= 350000 and encoded.length() % 4 == 0:
				var bytes := Marshalls.base64_to_raw(encoded)
				var image := Image.new()
				if image.load_png_from_buffer(bytes) == OK and image.get_width() == 640 and image.get_height() == 360:
					pm.albedo_texture = ImageTexture.create_from_image(image)
					pictures[i].visible = true
		if item == null:
			occupied[i] = false
			labels[i].text = "%02d" % (i + 1)
			materials[i].albedo_color = Color("97ac99")
		elif typeof(item) == TYPE_DICTIONARY and item.get("versionId") is String and item.get("title") is String:
			occupied[i] = true
			labels[i].text = "%02d · %s" % [i + 1, str(item.title).left(24)]
			labels[i].font_size = 24
			materials[i].albedo_color = Color("22675b")
		elif typeof(item) == TYPE_DICTIONARY and item.get("kind") in ["quiz", "card", "story"] and item.get("theme") in ["fresh", "celebration", "night"]:
			occupied[i] = true
			labels[i].text = "%02d · %s" % [i + 1, str(item.kind).to_upper()]
			materials[i].albedo_color = {"fresh": Color("287b6f"), "celebration": Color("d79b85"), "night": Color("294c66")}[item.theme]

func interact(position: Vector3) -> bool:
	for i in range(6):
		if position.distance_to(bodies[i].global_position) < 1.7:
			selected.emit(i)
			return true
	return false
