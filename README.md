# taskmaster

Distributed task runner tools. Designed to run tasks that affect external resources and master will only receive an
acknowledgement of the task completion and will not in form the feeder when the tasks are complete.

Using socket.io and is event driven.

Uses a MongoDB to backup and maintain task list when master fails.

Expects tasks to be idempotent. Master will assume that a task failed if it times out and will re-run it even though the
task may timeout due to the network between the master and worker failing and the worker actually still finishes.


