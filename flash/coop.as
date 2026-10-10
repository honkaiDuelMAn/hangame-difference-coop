var b = _global.hangameCoop = {started:false, ready:false, actor:0, ammo:[1,1], miniKey:"", marks:{}, lastFind:0, lastEpoch:"", sent:0};
var ei = flash.external.ExternalInterface;
b.scene = function() {
    var r = _global.Framework.root;
    if (r.minigame_mc2._visible && r.minigame_mc2._currentframe > 1) return r.minigame_mc2;
    if (r.minigame_mc._visible && r.minigame_mc._currentframe > 1) return r.minigame_mc;
    return null;
};
b.snapshot = function() {
    var f = _global.Framework;
    var s = f.status;
    var m = this.scene();
    var mode = m == null ? "puzzle" : (m.bullet_mc == undefined ? "mini-intro" : "mini");
    var epoch = mode + ":" + s.level + ":" + s.stage + ":" + (m == null ? "" : m._name + ":" + m.level + ":" + m.mode);
    var remain = m == null ? f.root.timebar_mc._value / 1000 : Math.max(0, (m.timeLimit - (isNaN(m.time) ? 0 : m.time)) / 30);
    var max = m.bullet_mc._totalframes - 1;
    return {mode:mode, epoch:epoch, life:s.life, item:s.item, find:s.find, level:s.level, stage:s.stage, score:s.score, time:remain, enabled:m == null ? f.logic.clickEnabled : (m.clickEnabled == true), bullets:m.bullet_mc == undefined ? [0,0] : [Math.max(0,max-this.ammo[0]+1),Math.max(0,max-this.ammo[1]+1)], kills:m.score, mission:m.mission, nativeAmmo:m.bullet_mc._currentframe, frame:f.root._currentframe};
};
b.start = function(character) {
    if (this.started) return false;
    this.started = true;
    this.marks = {};
    this.ammo = [1,1];
    this.lastFind = 0;
    var f = _global.Framework;
    f.root.start = true;
    f.root.practice = false;
    f.logic.characterCode = Number(character) == 2 ? 2 : 1;
    f.ui.showMain();
    return true;
};
b.reset = function() {
    var f = _global.Framework;
    f.root.timebar_mc.timer.clearTimer();
    f.logic.allRemoveEnemy();
    f.logic.allRemoveHint();
    f.logic.clickEnabled = false;
    this.started = false;
    this.ammo = [1,1];
    this.miniKey = "";
    this.marks = {};
    f.ui.showCharacter();
    return true;
};
b.begin = function(seat) {
    this.actor = Number(seat);
    this.poll();
    var m = this.scene();
    if (m.bullet_mc != undefined) m.bullet_mc.gotoAndStop(this.ammo[this.actor]);
    this.lastFind = _global.Framework.status.find;
    return this.snapshot();
};
b.end = function() {
    var m = this.scene();
    if (m.bullet_mc != undefined) this.ammo[this.actor] = m.bullet_mc._currentframe;
    this.colorMarks();
    return this.snapshot();
};
b.shoot = function() {
    var m = this.scene();
    if (m == null || m.clickEnabled != true || m.bullet_mc == undefined) return false;
    var threshold = m._name == "minigame_mc2" ? 2 : 3;
    if (m.delay < threshold) return false;
    // Run one original gun update. Do not advance a blocked cooldown and do
    // not hold shot=true across multiple frames in the faster second game.
    var c = m.cursor_mc;
    c.onMouseMove();
    c.onMouseDown();
    c.onEnterFrame();
    c.onMouseUp();
    return true;
};
b.reload = function() {
    var m = this.scene();
    if (m == null || m.clickEnabled != true || m.bullet_mc == undefined) return false;
    m.cursor_mc.onEnterFrame();
    return true;
};
b.colorMarks = function() {
    var f = _global.Framework;
    var im = f.logic.im;
    var s = this.snapshot();
    if (s.epoch != this.lastEpoch) {
        this.lastEpoch = s.epoch;
        this.marks = {};
        this.lastFind = 0;
    }
    if (s.find > this.lastFind && s.mode == "puzzle") {
        for (var i=this.lastFind+1; i<=s.find; i++) this.marks["success_"+i] = this.actor;
        this.lastFind = s.find;
    }
    for (var key in this.marks) {
        if (this.marks[key] == 1) {
            new Color(im.ef1[key]).setRGB(0x1679ff);
            new Color(im.ef2[key]).setRGB(0x1679ff);
        }
    }
};
b.poll = function() {
    var f = _global.Framework;
    if (f.root == undefined || typeof(f.ui.showMain) != "function") return;
    if (!this.ready) { this.ready = true; ei.call("coopEvent", "ready", {}); }
    if (!this.started) return;
    f.root.cursorboy_mc._visible = false;
    f.root.cursorgirl_mc._visible = false;
    f.logic.cursor_mc._visible = false;
    var m = this.scene();
    if (m != null) m.cursor_mc._visible = false;
    if (m.bullet_mc != undefined) {
        var key = m._name + ":" + f.status.level + ":" + f.status.stage + ":" + m.level + ":" + m.mode;
        if (key != this.miniKey) { this.miniKey = key; this.ammo = [1,1]; }
        m.bullet_mc._visible = false;
    }
    this.colorMarks();
    if (getTimer()-this.sent >= 100) { this.sent = getTimer(); ei.call("coopEvent", "state", this.snapshot()); }
};
ei.addCallback("coopStart", b, b.start);
ei.addCallback("coopReset", b, b.reset);
ei.addCallback("coopBeginAction", b, b.begin);
ei.addCallback("coopEndAction", b, b.end);
ei.addCallback("coopSnapshot", b, b.snapshot);
ei.addCallback("coopShoot", b, b.shoot);
ei.addCallback("coopReload", b, b.reload);
b.interval = setInterval(b, "poll", 33);
