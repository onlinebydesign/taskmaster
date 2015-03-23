'use strict';
module.exports = function (params) {
    setTimeout((function () {
        this.done('Done with import task!');
    }).bind(this), 10000);
};