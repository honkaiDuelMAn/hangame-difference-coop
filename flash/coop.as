var b = _global.hangameCoop = {started:false, ready:false, actor:0, ammo:[1,1], miniKey:"", marks:{}, lastFind:0, lastEpoch:"", sent:0};
var ei = flash.external.ExternalInterface;
b.pixelGrid = function(width,height) {
    this.pixelScale = Math.min(Number(width)/640,Number(height)/480);
    this.pixelOffsetX = (Number(width)-640*this.pixelScale)/2;
    this.pixelOffsetY = (Number(height)-480*this.pixelScale)/2;
    this.alignPictures();
    return true;
};
b.alignPictures = function() {
    var im = _global.Framework.logic.im;
    if (!(this.pixelScale > 0) || im.mc2.img == undefined) return;
    im.mc1.img._x=0;im.mc1.img._y=0;im.mc2.img._x=0;im.mc2.img._y=0;
    if (im.magic_b) return;
    var images=[im.mc1.img,im.mc2.img];
    for(var i=0;i<2;i++) {
        var m=images[i].transform.concatenatedMatrix;
        if(m.b!=0 || m.c!=0 || m.a!=1 || m.d!=1) continue;
        // display.mjs chooses a surface size that admits exact twip offsets.
        // Move only the bitmap, by at most half an output pixel; source art,
        // hitboxes, answer areas and native outer animations stay unchanged.
        var dx=(Math.round(m.tx*this.pixelScale+this.pixelOffsetX)-this.pixelOffsetX)/this.pixelScale-m.tx;
        var dy=(Math.round(m.ty*this.pixelScale+this.pixelOffsetY)-this.pixelOffsetY)/this.pixelScale-m.ty;
        images[i]._x=Math.round(dx*20)/20;
        images[i]._y=Math.round(dy*20)/20;
    }
};
b.scene = function() {
    var r = _global.Framework.root;
    if (r.minigame_mc2._visible && r.minigame_mc2._currentframe > 1) return r.minigame_mc2;
    if (r.minigame_mc._visible && r.minigame_mc._currentframe > 1) return r.minigame_mc;
    return null;
};
b.resultTarget = function() {
    var f = _global.Framework;
    var popup = f.root.popup_mc;
    if (f.ui.selected != popup || !popup._visible) return null;
    var parent = typeof(popup.mc.next_btn.onRelease) == "function" ? popup.mc : popup;
    if (!parent._visible || typeof(parent.next_btn.onRelease) != "function") return null;
    return {parent:parent,button:parent.next_btn,centered:parent == popup};
};
b.resultButton = function(x,y) {
    var target = this.resultTarget();
    if (!this.started || target == null || !target.button.enabled || !target.button._visible) return false;
    var button = target.button;
    var point = {x:Number(x),y:Number(y)};
    if (!(point.x >= 0 && point.x <= 640 && point.y >= 0 && point.y <= 480)) return false;
    target.parent.globalToLocal(point);
    // Use the native NEXT rectangle once its result animation reveals it.
    if (!(button._width > 0) || !(button._height > 0)) return false;
    // Original Button 298 starts at (0,0); outer-popup Button 519 is centered.
    var left = button._x + (target.centered ? -50.15*button._xscale/100 : 0);
    var top = button._y + (target.centered ? -18.15*button._yscale/100 : 0);
    if (point.x < left || point.x > left+button._width || point.y < top || point.y > top+button._height) return false;
    button.onRelease();
    return true;
};
b.snapshot = function() {
    var f = _global.Framework;
    var s = f.status;
    var m = this.scene();
    var result = this.resultTarget() != null;
    var mode = result ? "result" : (m == null ? "puzzle" : (m.bullet_mc == undefined ? "mini-intro" : "mini"));
    var epoch = mode + ":" + s.level + ":" + s.stage + ":" + (result ? f.root.popup_mc._currentframe : (m == null ? "" : m._name + ":" + m.level + ":" + m.mode));
    var remain = result ? 0 : (m == null ? f.root.timebar_mc._value / 1000 : Math.max(0, (m.timeLimit - (isNaN(m.time) ? 0 : m.time)) / 30));
    var max = m.bullet_mc._totalframes - 1;
    return {mode:mode, epoch:epoch, life:s.life, item:s.item, find:s.find, level:s.level, stage:s.stage, score:s.score, time:remain, enabled:result ? false : (m == null ? f.logic.clickEnabled : (m.clickEnabled == true)), bullets:m.bullet_mc == undefined ? [0,0] : [Math.max(0,max-this.ammo[0]+1),Math.max(0,max-this.ammo[1]+1)], kills:m.score, mission:m.mission, nativeAmmo:m.bullet_mc._currentframe, frame:f.root._currentframe};
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
    this.pausedTimer = null;
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
b.pause = function(value) {
    var timer = _global.Framework.root.timebar_mc.timer;
    if (value) {
        if (timer.started && !timer.paused) {
            this.pausedTimer = timer;
            timer.pause();
        }
    } else if (this.pausedTimer != null) {
        this.pausedTimer.unpause();
        this.pausedTimer = null;
    }
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
b.useItem = function(kind) {
    var f = _global.Framework;
    var s = this.snapshot();
    if (s.mode != "puzzle" || !s.enabled) return false;
    var button = kind == "life" ? f.root.helpme : (kind == "glasses" ? f.root.magic : null);
    if (button == null || !button.enabled || typeof(button.onRelease) != "function") return false;
    if ((kind == "life" ? s.life : s.item) <= 0) return false;
    // Invoke the unchanged native item handler without entering its hover art.
    button.onRelease();
    return true;
};
b.introButton = function(x,y) {
    var m = this.scene();
    var button = m.start_btn;
    if (!this.started || m == null || m.bullet_mc != undefined || !button._visible) return false;
    if (typeof(button.onRelease) != "function" || !button.hitTest(Number(x),Number(y),true)) return false;
    button.onRelease();
    return true;
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
    this.alignPictures();
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
ei.addCallback("coopPause", b, b.pause);
ei.addCallback("coopPixelGrid", b, b.pixelGrid);
ei.addCallback("coopBeginAction", b, b.begin);
ei.addCallback("coopEndAction", b, b.end);
ei.addCallback("coopUseItem", b, b.useItem);
ei.addCallback("coopIntroButton", b, b.introButton);
ei.addCallback("coopResultButton", b, b.resultButton);
ei.addCallback("coopSnapshot", b, b.snapshot);
ei.addCallback("coopShoot", b, b.shoot);
ei.addCallback("coopReload", b, b.reload);
b.interval = setInterval(b, "poll", 33);
