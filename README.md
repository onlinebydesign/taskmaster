# taskmaster

Distributed task runner tools. Designed to run tasks that affect external resources and master will only receive an
acknowledgement of the task completion and will not in form the feeder when the tasks are complete.

Using socket.io and is event driven.

Uses a MongoDB to backup and maintain task list when master fails.

Expects tasks to be idempotent. Master will assume that a task failed if it times out and will re-run it even though the
task may timeout due to the network between the master and worker failing and the worker actually still finishes.

Example of Feeder
```javascript
var feederOptions = {
    connectionString: 'tcp://localhost:3000'
};

var feeder = require('feeder')(feederOptions);

var batch = [
    {
        task: 'doTask',
        params: {paramA: 1, paramB: 2}
    },
    {
        task: 'doOtherTask',
        timeout: 20000,
        priority: 100,
        params: {paramA: 1, paramB: 2}
    }
];

feeder.add(batch);
```

Example of Task
```javascript
module.exports = function (params) {
    setTimeout((function () {
        this.done('Done with import task!');
    }).bind(this), 10000);
};
```

Create a copy of config.copy.json and rename it config.json. Edit fields to match your need.

This was included in a presentation at [Boise Code Camp](http://lanyrd.com/2015/boise-code-camp/sdkfqb/). Here is a link to the [slides](https://slides.com/jedediahsmith/dist).