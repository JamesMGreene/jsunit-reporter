# jsunit-reporter
Add QUnit-style lifecycle logging callbacks into the legacy JsUnit framework.  

## Usage
 1. On the JsUnit [testRunner.html](https://github.com/pivotal/jsunit/blob/master/testRunner.html) page, add a script
    element inclusion for the ["jsunit-reporter.js"](https://github.com/JamesMGreene/jsunit-reporter/blob/master/jsunit-reporter.js)
    file _after_ all of the existing "app/*.js" script element inclusions but _before_ the inline script element, i.e. 
    [here](https://github.com/pivotal/jsunit/blob/16a70b2b2bf96a80adca1d0fa6144dd61e3ba59b/testRunner.html#L14).
 2. On the JsUnit [testRunner.html](https://github.com/pivotal/jsunit/blob/master/testRunner.html) page, add a script
    element inclusion to a file like ["example-usage.js"](https://github.com/JamesMGreene/jsunit-reporter/blob/master/example-usage.js)
    _immediately_ after the ["jsunit-reporter.js"](https://github.com/JamesMGreene/jsunit-reporter/blob/master/jsunit-reporter.js)
    inclusion to actually setup logging callbacks before the test run begins.
 3. _Enjoy!_


## Extension
If you have custom JsUnit assertion types, you can still take advantage of this reporter!  
All you need to do is:
 1. Ensure your custom assertions end by calling down the stack to the `JsUnit._assert` method.
 2. Save the appropriate metadata for your assertion into the `JsUnit.currentAssertion` object on the relevent `window` object, e.g.:
```js
    function assertThatUsingJsUnitIsCrazy() {
        if (!JsUnit.currentAssertion) {
            // Actual metadata will vary depending on your assertion type.
            // See the actual jsunit-reporter.js code for more examples.
            JsUnit.currentAssertion = {
                name: 'assertThatUsingJsUnitIsCrazy',
                actual: JsUnit._nonCommentArg(2, 2, arguments),
                expected: JsUnit._nonCommentArg(1, 2, arguments)
            };
        }
        
        /* ...assert whatever, just be sure to end by calling `JsUnit._assert` */
    };
```

---

_**This repo was originally ported over from my extensive Gist: https://gist.github.com/JamesMGreene/4371789**_
