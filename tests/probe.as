function probeInspect(path) {
    var target = eval(path);
    var result = new Object();
    result.path = path;
    result.type = typeof(target);
    var fields = new Object();
    ASSetPropFlags(target, null, 0, 7);
    var count = 0;
    for (var key in target) {
        if (count++ > 500) break;
        var v = target[key];
        if (typeof(v) == "number" || typeof(v) == "string" || typeof(v) == "boolean") fields[key] = v;
        else fields[key] = "[" + typeof(v) + "]";
    }
    result.fields = fields;
    return result;
}
function probeCall(path, method, a, b, c) {
    var target = eval(path);
    return target[method](a, b, c);
}
function probeSet(path, key, value) {
    eval(path)[key] = value;
    return true;
}
function probeRead(path) { return eval(path); }
function probeCursor() {
    var root = _global.Framework.root;
    var mc = _global.Framework.logic.cursor_mc;
    return {mouse:{x:root._xmouse,y:root._ymouse},bounds:mc.image_mc.getBounds(root),x:mc._x,y:mc._y,scale:mc._xscale,imageScale:mc.image_mc._xscale,imageFrame:mc.image_mc._currentframe};
}
function probeCursorAssets() {
    var r = _global.Framework.root;
    return {boy:r.cursorboy_mc.image_mc.getBounds(r.cursorboy_mc),girl:r.cursorgirl_mc.image_mc.getBounds(r.cursorgirl_mc)};
}
function probeTargets() {
    var r = _global.Framework.root;
    var m = r.minigame_mc2._visible && r.minigame_mc2._currentframe > 1 ? r.minigame_mc2 : r.minigame_mc;
    var result = [];
    for (var i=1;i<=15;i++) {
        var t = m["target"+i];
        result.push({index:i,frame:t._currentframe,dead:t.isDead,visible:t._visible,bounds:t.hit.getBounds(r),x:t._x,y:t._y});
    }
    return result;
}
function probeHook(path, method) {
    var obj = eval(path);
    var original = obj[method];
    if (typeof(original) != "function") return false;
    obj[method] = function() {
        var args = [];
        for (var i=0; i<arguments.length; i++) {
            var a = arguments[i];
            if (typeof(a) == "object" || typeof(a) == "movieclip") {
                var d = {};
                ASSetPropFlags(a, null, 0, 7);
                for (var k in a) { if (typeof(a[k]) == "number" || typeof(a[k]) == "string" || typeof(a[k]) == "boolean") d[k] = a[k]; }
                args.push(d);
            } else args.push(a);
        }
        _root.probeLast = {path:path, method:method, args:args, x:_root._xmouse, y:_root._ymouse};
        if (_root.probeTrace == undefined) _root.probeTrace = [];
        _root.probeTrace.push(_root.probeLast);
        return original.apply(this, arguments);
    };
    return true;
}
function probeState() {
    var s = _global.Framework.status;
    var l = _global.Framework.logic;
    var boxes = [];
    for (var i=0; i<l.im.boxs.length; i++) {
        var mc = l.im.boxs[i];
        boxes.push({name:mc._name, bounds:mc.getBounds(_root), pair:mc.pair._name, visible:mc._visible, ok:mc.ok == 1});
    }
    return {life:s.life, item:s.item, find:s.find, level:s.level, stage:s.stage, score:s.score, character:l.characterCode, enabled:l.clickEnabled, frame:_root._currentframe, boxes:boxes, order:l.orderMap};
}
flash.external.ExternalInterface.addCallback("probeInspect", this, probeInspect);
flash.external.ExternalInterface.addCallback("probeCall", this, probeCall);
flash.external.ExternalInterface.addCallback("probeSet", this, probeSet);
flash.external.ExternalInterface.addCallback("probeRead", this, probeRead);
flash.external.ExternalInterface.addCallback("probeCursor", this, probeCursor);
flash.external.ExternalInterface.addCallback("probeCursorAssets", this, probeCursorAssets);
flash.external.ExternalInterface.addCallback("probeTargets", this, probeTargets);
flash.external.ExternalInterface.addCallback("probeHook", this, probeHook);
flash.external.ExternalInterface.addCallback("probeState", this, probeState);
flash.external.ExternalInterface.call("probeEvent", "ready");
