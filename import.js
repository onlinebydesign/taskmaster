module.exports = function (task) {
    setTimeout(function () {
        task.done('Done with task!!!!!!!!!!');
    }, 1000);
};