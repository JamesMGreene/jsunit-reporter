(function() {
    var loggingEventNames = [
        'begin',
        'moduleStart',
        'testStart',
        'log',
        'testDone',
        'moduleDone',
        'done'
    ];
    
    // Initialize!
    for (var i = 0, len = loggingEventNames.length; i < len; i++) {
        // Assign handlers functions to all of the new logging callbacks on the global `JsUnit` object
        (function(logEventName) {
            JsUnit[logEventName].call(this, function(data) {
                console.log("JsUnit." + logEventName + ": " + JSON.stringify(data));
            });
        })(loggingEventNames[i]);
    }

})();
