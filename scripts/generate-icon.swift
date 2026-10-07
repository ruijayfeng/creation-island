import AppKit
// Original geometric island mark; generated from primitives, no external artwork.
let output = CommandLine.arguments[1]
let image = NSImage(size: NSSize(width: 1024, height: 1024))
image.lockFocus()
NSColor(red:0.965,green:0.957,blue:0.925,alpha:1).setFill()
NSBezierPath(roundedRect:NSRect(x:40,y:40,width:944,height:944),xRadius:220,yRadius:220).fill()
NSColor(red:0.78,green:0.875,blue:0.796,alpha:1).setFill()
NSBezierPath(ovalIn:NSRect(x:216,y:248,width:592,height:592)).fill()
NSColor(red:0.157,green:0.482,blue:0.435,alpha:1).setFill()
let island=NSBezierPath();island.move(to:NSPoint(x:216,y:544));island.line(to:NSPoint(x:808,y:544));island.appendArc(withCenter:NSPoint(x:512,y:544),radius:296,startAngle:0,endAngle:180,clockwise:true);island.close();island.fill()
NSColor(red:0.965,green:0.957,blue:0.925,alpha:1).setFill()
let hill=NSBezierPath();hill.move(to:NSPoint(x:306,y:544));hill.line(to:NSPoint(x:448,y:726));hill.line(to:NSPoint(x:586,y:544));hill.close();hill.fill()
NSColor(red:0.906,green:0.718,blue:0.471,alpha:1).setFill();NSBezierPath(ovalIn:NSRect(x:626,y:689,width:78,height:78)).fill()
image.unlockFocus()
let bitmap=NSBitmapImageRep(data:image.tiffRepresentation!)!
try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:output))
