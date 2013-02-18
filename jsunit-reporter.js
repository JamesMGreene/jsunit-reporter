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
    
    var loggingCallbacks = {},
        toArray = (function() {
            var _slice = [].slice;
            return function(o) { return _slice.call(o, 0); }
        })(),
        i,
        len,
        logEventName,
        currentModuleName,
        currentModuleStartTime;
        
    function registerLoggingCallback(loggingEventName, callbackFn) {
        if (loggingCallbacks[loggingEventName] && typeof callbackFn === 'function') {
            loggingCallbacks[loggingEventName].push(callbackFn);
        }
    }
    
    function runLoggingCallbacks(loggingEventName, data) {
        var callbacks = loggingCallbacks[loggingEventName];
        if (callbacks && callbacks.length) {
            for (i = 0, len = callbacks.length; i < len; i++) {
                callbacks[i].call(this, data);
            }
        }
    }
    
    // Initialize!
    for (i = 0, len = loggingEventNames.length; i < len; i++) {
        (function(logEventName) {
            loggingCallbacks[logEventName] = [];
        
            // Create some new methods on the global `JsUnit` object
            JsUnit[logEventName] = function(callbackFn) {
                registerLoggingCallback(logEventName, callbackFn);
            };
        })(loggingEventNames[i]);
    }
    
    
    // Store the original versions of these methods for chaining in overridden versions
    var __jsunit__ = {
        TestManager: {
            setup: JsUnitTestManager.prototype.setup,
            start: JsUnitTestManager.prototype.start,
            executeTestFunction: JsUnitTestManager.prototype.executeTestFunction,
            _setTestStatus: JsUnitTestManager.prototype._setTestStatus,
            _done: JsUnitTestManager.prototype._done,
            abort: JsUnitTestManager.prototype.abort
        },
        ClassicUiManager: {
            learnedOfTestPage: JsUnit.ClassicUiManager.prototype.learnedOfTestPage,
            testCompleted: JsUnit.ClassicUiManager.prototype.testCompleted
        },
        ModernUiManager: {
            learnedOfTestPage: JsUnit.ModernUiManager.prototype.learnedOfTestPage,
            testCompleted: JsUnit.ModernUiManager.prototype.testCompleted
        }
    };
    
    
    /**
     * Add a method to run logging callbacks
     */
    JsUnitTestManager.prototype.runLoggingCallbacks = runLoggingCallbacks;
    
    /**
     * Override any necessary methods in order to run logging callbacks appropriately
     */
    
    JsUnitTestManager.prototype.setup = function() {
        this.successCount = 0;
        __jsunit__.TestManager.setup.call(this);
    }
    
    JsUnitTestManager.prototype.start = function() {
        __jsunit__.TestManager.start.call(this);
        this.runLoggingCallbacks('begin');
    };
    
    function getCurrentModuleName() {
        return top.testManager._currentTestFunctionNameWithTestPageName(false).split(':')[0];
    }
    
    function moduleStartAndDoneListener(testPage, event) {
        if (event == JsUnit.TestPage.STATUS_CHANGE_EVENT) {
            // moduleStart
            if (testPage.running === true) {
                currentModuleName = getCurrentModuleName();
                var details = {
                    name: currentModuleName
                };
                top.testManager.runLoggingCallbacks('moduleStart', details);
                
                currentModuleStartTime = top.testManager.testFrame.startTime || new Date();
                
                // Inject assertion overrides to bind 'log' logging callbacks to the new testFrame
                var targetFrame = top.testManager.testFrame;
                targetFrame.overrideAssertionsForLogging = overrideAssertionsForLogging;
                targetFrame.overrideAssertionsForLogging.call(targetFrame, targetFrame);
            }
            // moduleDone
            else if (testPage.running === false) {
                var results = {
                    name: currentModuleName,
                    failed: testPage.failureCount + testPage.errorCount,
                    passed: testPage.successCount,
                    total: testPage.totalCount,
                    runtime: (new Date() - currentModuleStartTime)
                };
                top.testManager.runLoggingCallbacks('moduleDone', results);
                
                currentModuleName = null;
                currentModuleStartTime = null;
            }
        }
    }
    
    JsUnit.ClassicUiManager.prototype.learnedOfTestPage = function(testPage) {
        testPage.listen(moduleStartAndDoneListener);  // 'moduleStart' and 'moduleDone'
        __jsunit__.ClassicUiManager.learnedOfTestPage(testPage);
    };
    
    JsUnit.ModernUiManager.prototype.learnedOfTestPage = function(testPage) {
        testPage.listen(moduleStartAndDoneListener);  // 'moduleStart' and 'moduleDone'
        __jsunit__.ModernUiManager.learnedOfTestPage(testPage);
    };
    
    JsUnitTestManager.prototype.executeTestFunction = function(theTest) {
        var details = {
            name: theTest.testName,
            module: currentModuleName
        };
        this.runLoggingCallbacks('testStart', details);
        
        __jsunit__.TestManager.executeTestFunction.call(this, theTest);
    };
    
    JsUnitTestManager.prototype._setTestStatus = function(test, excep) {
        __jsunit__.TestManager._setTestStatus.call(this, test, excep);
        if (test.status === 'success') {
            this.successCount++;
        }
    };
    
    //
    // NOTE:
    // 'log' is dealt with at the bottom of this file to avoid cluttering up
    // the more straight-forward overrides for the other logging callbacks.
    //
    
    function notifyTestDone(theTest) {
        var results = {
            name: theTest.testName,
            module: currentModuleName,
            failed: ((theTest.status === 'failure' || theTest.status === 'error') ? 1 : 0),
            passed: (theTest.status === 'success' ? 1 : 0),
            total: 1,
            runtime: theTest.timeTaken
        };
        top.testManager.runLoggingCallbacks('testDone', results);
    }
    
    JsUnitTestManager.prototype._setTestStatus = function(test, excep) {
        
    };
    
    JsUnit.ClassicUiManager.prototype.testCompleted = function(theTest) {
        notifyTestDone(theTest);  // 'testDone'
        __jsunit__.ClassicUiManager.testCompleted.call(this, theTest);
    };
    
    JsUnit.ModernUiManager.prototype.testCompleted = function(theTest) {
        notifyTestDone(theTest);  // 'testDone'
        __jsunit__.ModernUiManager.testCompleted.call(this, theTest);
    };
    
    //
    // NOTE: 'moduleDone' is dealt with in the same method as 'moduleStart', see above
    //
    
    JsUnitTestManager.prototype._done = function() {
        var results = {
            failed: (this.failureCount + this.errorCount),
            passed: this.successCount,
            total: this.totalCount,
            runtime: (new Date() - this._timeRunStarted)
        };
        this.runLoggingCallbacks('done', results);
        
        __jsunit__.TestManager._done.call(this);
    };
    
    JsUnitTestManager.prototype.abort = function() {
        
        // TODO: Throw/push 'global failure' and then call 'done' logging callback
        
        __jsunit__.TestManager.abort.call(this);
    };
    
    function overrideAssertionsForLogging(window) {
        // Store the original versions of these methods for chaining in overridden versions
        var __jsunit__ = {
            Core: {
                _assert: window.JsUnit._assert,
                Failure: window.JsUnit.Failure,
                'Error': window.JsUnit.Error
            },
            Assert: (function() {
                var assertionNames = [
                    'assert', 'assertTrue', 'assertFalse', 'assertEquals', 'assertNotEquals', 'assertNull', 'assertNotNull',
                    'assertUndefined', 'assertNotUndefined', 'assertNaN', 'assertNotNaN', 'assertObjectEquals', 'assertArrayEquals',
                    'assertEvaluatesToTrue', 'assertEvaluatesToFalse', 'assertHTMLEquals', 'assertHashEquals', 'assertRoughlyEquals',
                    'assertContains', 'assertArrayEqualsIgnoringOrder', 'assertEqualsIgnoringOrder', 'fail', 'error'
                ];
                var asserts = {};
                for (i = 0, len = assertionNames.length; i < len; i++) {
                    asserts[assertionNames[i]] = window[assertionNames[i]];
                }
                return asserts;
            })()
        };
        
        // Ensure this is global to the pertinent `window.JsUnit` object, such that anyone who makes
        // custom JsUnit assertion methods can also leverage this logging callback functionality
        window.JsUnit.currentAssertion = null;

        //
        // NOTE: ALL of the code that follows is for handling the 'log' logging callback
        // { module: 'module', name: 'test', result: true, actual: null, expected: null, message: '...', source: 'stackTrace...' }
        //
        
        window.JsUnitFailure = window.JsUnit.Failure = function(comment, message) {
            __jsunit__.Core.Failure.call(this, comment, message);
            
            // Make it available:  { isJsUnitFailure: true, comment: '...', jsUnitMessage: '...', stackTrace: '...' }
            window.JsUnit.currentAssertion.failure = this;
            top.testManager.runLoggingCallbacks('log', window.JsUnit.currentAssertion);
            window.JsUnit.currentAssertion = null;
        };
        
        window.JsUnitError = window.JsUnit.Error = function(description) {
            __jsunit__.Core.Error.call(this, description);
            
            // Make it available:  { description: '', stackTrace: '' }
            window.JsUnit.currentAssertion.error = this;
            top.testManager.runLoggingCallbacks('log', window.JsUnit.currentAssertion);
            window.JsUnit.currentAssertion = null;
        };
        
        window.JsUnit._assert = function(comment, booleanValue, failureMessage) {
            window.JsUnit.currentAssertion.message = comment || null;
            window.JsUnit.currentAssertion.result = !!booleanValue;
            
            // Only log this is `result` is successful, as otherwise this will be handled by `JsUnit.Failure`
            if (window.JsUnit.currentAssertion.result) {
                top.testManager.runLoggingCallbacks('log', window.JsUnit.currentAssertion);
                window.JsUnit.currentAssertion = null;
            }
            
            __jsunit__.Core._assert.call(this, comment, booleanValue, failureMessage);
        };
        
        window.assert = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assert',
                    actual: window.JsUnit._nonCommentArg(1, 1, arguments),
                    expected: true
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };
        
        window.assertTrue = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertTrue',
                    actual: window.JsUnit._nonCommentArg(1, 1, arguments),
                    expected: true
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };
        
        window.assertFalse = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertFalse',
                    actual: window.JsUnit._nonCommentArg(1, 1, arguments),
                    expected: false
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };
        
        window.assertEquals = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertEquals',
                    actual: window.JsUnit._nonCommentArg(2, 2, arguments),
                    expected: window.JsUnit._nonCommentArg(1, 2, arguments)
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };
        
        window.assertNotEquals = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertNotEquals',
                    actual: window.JsUnit._nonCommentArg(2, 2, arguments),
                    expected: window.JsUnit._nonCommentArg(1, 2, arguments)
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertNull = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertNull',
                    actual: window.JsUnit._nonCommentArg(1, 1, arguments),
                    expected: null
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertNotNull = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertNotNull',
                    actual: window.JsUnit._nonCommentArg(1, 1, arguments),
                    expected: null
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertUndefined = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertUndefined',
                    actual: window.JsUnit._nonCommentArg(1, 1, arguments),
                    expected: undefined
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertNotUndefined = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertNotUndefined',
                    actual: window.JsUnit._nonCommentArg(1, 1, arguments),
                    expected: undefined
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertNaN = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertNaN',
                    actual: window.JsUnit._nonCommentArg(1, 1, arguments),
                    expected: NaN
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertNotNaN = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertNotNaN',
                    actual: window.JsUnit._nonCommentArg(1, 1, arguments),
                    expected: NaN
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertObjectEquals = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertObjectEquals',
                    actual: window.JsUnit._nonCommentArg(2, 2, arguments),
                    expected: window.JsUnit._nonCommentArg(1, 2, arguments)
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertArrayEquals = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertArrayEquals',
                    actual: window.JsUnit._nonCommentArg(2, 2, arguments),
                    expected: window.JsUnit._nonCommentArg(1, 2, arguments)
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertEvaluatesToTrue = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertEvaluatesToTrue',
                    actual: window.JsUnit._nonCommentArg(1, 1, arguments),
                    expected: true
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertEvaluatesToFalse = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertEvaluatesToFalse',
                    actual: window.JsUnit._nonCommentArg(1, 1, arguments),
                    expected: false
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertHTMLEquals = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertHTMLEquals',
                    actual: window.JsUnit._nonCommentArg(2, 2, arguments),
                    expected: window.JsUnit._nonCommentArg(1, 2, arguments)
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertHashEquals = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertHashEquals',
                    actual: window.JsUnit._nonCommentArg(2, 2, arguments),
                    expected: window.JsUnit._nonCommentArg(1, 2, arguments)
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertRoughlyEquals = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertRoughlyEquals',
                    actual: window.JsUnit._nonCommentArg(2, 3, arguments),
                    expected: window.JsUnit._nonCommentArg(1, 3, arguments),
                    tolerance: window.JsUnit._nonCommentArg(3, 3, arguments)
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertContains = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertContains',
                    collection: window.JsUnit._nonCommentArg(2, 2, arguments),
                    value: window.JsUnit._nonCommentArg(1, 2, arguments)
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertArrayEqualsIgnoringOrder = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertArrayEqualsIgnoringOrder',
                    actual: window.JsUnit._nonCommentArg(2, 2, arguments),
                    expected: window.JsUnit._nonCommentArg(1, 2, arguments)
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.assertEqualsIgnoringOrder = function() {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'assertEqualsIgnoringOrder',
                    actual: window.JsUnit._nonCommentArg(2, 2, arguments),
                    expected: window.JsUnit._nonCommentArg(1, 2, arguments)
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].apply(this, toArray(arguments));
        };

        window.fail = function(failureMessage) {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'fail',
                    message: failureMessage
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].call(this, failureMessage);
        };

        window.error = function(errorMessage) {
            if (!window.JsUnit.currentAssertion) {
                window.JsUnit.currentAssertion = {
                    name: 'error',
                    message: errorMessage
                };
            }
            
            __jsunit__.Assert[window.JsUnit.currentAssertion.name].call(this, errorMessage);
        };
    }

})();
