// Module dependencies
const pkg = require("../package.json");
const cluster = require("cluster");

// Replace console
console = require("./logger")(console);

// Make sure this is the master
if (!cluster.isMaster) {
    console.log("overseer can only be run as master");
    process.exit(0);
}

var overseer = {};

overseer.run = function() {
    process.stdout.write(banner);
};

// Cool ascii art banner
var banner = "\n"+
"  _____   _____ _ __ ___  ___  ___ _ __ \n"+
" / _ \\ \\ / / _ \\ '__/ __|/ _ \\/ _ \\ '__|\n"+
"| (_) \\ V /  __/ |  \\__ \\  __/  __/ |   \n"+
" \\___/ \\_/ \\___|_|  |___/\\___|\\___|_|  \n"+ 
"                                        \n";

module.exports = function () {
    if (arguments.length) {
        if (typeof arguments[0] === "object") {
            var options = arguments[0];
        } else if (typeof arguments[0] === "string") {
            var file = arguments[1];
            if (arguments[1] && typeof arguments[1] === "object") {

            }
        }
    }
    overseer;
};