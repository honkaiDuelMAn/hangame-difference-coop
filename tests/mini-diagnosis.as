function miniCallExact(path, method, args) {
    var obj = eval(path);
    return obj[method].apply(obj, args == undefined ? [] : args);
}
function miniInspect(path) {
    var obj = eval(path);
    var keys = {};
    var clips = {};
    var functions = [];
    ASSetPropFlags(obj, null, 0, 7);
    for (var k in obj) {
        var value = obj[k];
        var type = typeof(value);
        if (type == "movieclip") clips[k] = {name:value._name,frame:value._currentframe,total:value._totalframes,visible:value._visible,x:value._x,y:value._y};
        else if (type == "function") functions.push(k);
        else if (type == "object") keys[k] = "[object]";
        else keys[k] = value;
    }
    return {keys:keys,clips:clips,functions:functions};
}
flash.external.ExternalInterface.addCallback("miniCallExact", this, miniCallExact);
flash.external.ExternalInterface.addCallback("miniInspect", this, miniInspect);
function miniCooldown(path, delay) {
    var m = eval(path);
    m.delay = delay;
    m.bullet_mc.gotoAndStop(1);
    m.cursor_mc.onMouseDown();
    m.cursor_mc.onEnterFrame();
    m.cursor_mc.onMouseUp();
    return {delayInput:delay,delayOut:m.delay,bulletFrame:m.bullet_mc._currentframe,score:m.score};
}
flash.external.ExternalInterface.addCallback("miniCooldown", this, miniCooldown);
function miniReloadFrame(path) {
    var m = eval(path);
    m.delay = 30;
    m.bullet_mc.gotoAndStop(3);
    m.cursor_mc.onEnterFrame();
    return {delay:m.delay,bulletFrame:m.bullet_mc._currentframe};
}
function miniAmmoBoundary(path, frame) {
    var m = eval(path);
    m.delay = 30;
    m.bullet_mc.gotoAndStop(frame);
    m.cursor_mc.onMouseDown();
    m.cursor_mc.onEnterFrame();
    m.cursor_mc.onMouseUp();
    return {before:frame,after:m.bullet_mc._currentframe,delay:m.delay};
}
flash.external.ExternalInterface.addCallback("miniReloadFrame", this, miniReloadFrame);
flash.external.ExternalInterface.addCallback("miniAmmoBoundary", this, miniAmmoBoundary);
function miniNativeShot(path) {
    var m = eval(path);
    var beforeFrame = m.bullet_mc._currentframe;
    var beforeScore = m.score;
    m.cursor_mc.onMouseMove();
    m.cursor_mc.onMouseDown();
    m.cursor_mc.onEnterFrame();
    m.cursor_mc.onMouseUp();
    return {beforeFrame:beforeFrame,afterFrame:m.bullet_mc._currentframe,beforeScore:beforeScore,afterScore:m.score,delayAfter:m.delay};
}
flash.external.ExternalInterface.addCallback("miniNativeShot", this, miniNativeShot);
