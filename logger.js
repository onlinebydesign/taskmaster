'use strict';
module.exports = function (options) {
    if (options.logger) {
        return require(options.logger)(options);
    }

    return new function() {
        //Basic logging to the screen
        this.info = function () {
            console.log.apply(this, arguments);
        };
        this.warn = function () {
            console.log.apply(this, arguments);
        };
        this.error = function () {
            console.error.apply(this, arguments);
        };
    };
};
