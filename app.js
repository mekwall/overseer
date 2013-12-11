const http = require("http");

var server = http.createServer();

server.listen(3000, function() {
	console.log("Listening on 3000");
});