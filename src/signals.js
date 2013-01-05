// Module dependencies
const fs = require("fs");

module.exports = function (overseer) {

    // Debugger
    process.on("SIGUSR1", function () {
        console.info("Master: Received SIGUSR1 from system");
    });

    // Graceful restart
    process.on("SIGUSR2",function(){
        console.info("Master: Received SIGUSR2 from system");
        overseer.emit("restartWorkers");
    });

    // Graceful shutdown
    process.on("SIGHUP",function(){
        console.info("Master: Received SIGHUP from system");
        overseer.workers.forEach(function (worker) {
            worker.send({ cmd: "stop" });
        });
    });

    // Terminate process
    process.on("SIGTERM", function () {
        console.info("Master: Received SIGTERM from system");
        process.exit();
    });

    // User wish to interrupt the process
    process.on("SIGINT", function () {
        console.info("Master: Recieved SIGINT from system");
        process.exit();
    });

    // Suspend process
    process.on("SIGTSTP", function () {
        console.info("Master: Recieved SIGTSTP from system");
    });

    // Continue process
    process.on("SIGCONT", function () {
        console.info("Master: Recieved SIGCONT from system");
    });

    // Windows doesn't use POSIX signals
    if (process.platform === "win32") {
        const tty = require("tty");
        // Check if it's a terminal or not
        if (tty.isatty(process.stdout.fd)) {
            const keypress = require("keypress");
            keypress(process.stdin);
            process.stdin.resume();
            process.stdin.setRawMode(true);
            process.stdin.setEncoding("utf8");
            process.stdin.on("keypress", function(char, key) {
                if (key && key.ctrl && key.name == "c") {
                    process.emit("SIGINT");
                } else if (key && key.ctrl && key.name == "z") {
                    process.emit("SIGTSTP");
                } else if (key && key.ctrl && key.name == "d") {
                    process.emit("SIGUSR1");
                } else if (key && key.ctrl && key.name == "r") {
                    process.emit("SIGUSR2");
                }
            });
        }
    }
}