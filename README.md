# Microserv
![Travis CI](https://travis-ci.org/dstreet/microserv.svg?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/dstreet/microserv/badge.svg)](https://snyk.io/test/github/dstreet/microserv)
[![npm](https://img.shields.io/npm/v/microserv.svg)]()

JSON-RPC over websocket with multicast service discovery with a browser compatible client

## Installation
```
npm install --save microserv
```

## Usage

### Service A
```javascript
const { Server, Service } = require('microserv')

const server = new Server('my-app', { port: 3000 })
const msgService = new Service('message')

msgService.register('getMessage', () => {
	return 'Hello, world!'
})

server.addService(msgService)
server.listen()
server.announce()
```

### Service B
```javascript
const http = require('http')
const { Server, Service } = require('microserv')

const server = new Server('my-app', { port: 3001 })
const mathService = new Service('math')

mathService.register('add', (a, b) => {
	return a + b
})

server.addService(mathService)

// Wait for the message service to be ready
server.need('message')
	.then(([ message ]) => {
		const app = http.createServer((req, res) => {
			res.statusCode = 200
			res.setHeader('Content-Type', 'text/plain')

			// Call the message service `getMessage` method
			message.getMessage()
				.then(msg => {
					res.end(msg)
					// { type: 'string', data: 'Hello, world!' }
				})
		})

		app.listen(8080, '127.0.0.1')
	})

server.listen()
server.announce()
```

### Client
```javascript
const { Client } = require('microserv')

const client = new Client()

client.need('message', 'math')
	.then(([ message, math ]) => {
		message
			.getMessage()
			.then(msg => console.log(msg))

		math
			.add(1, 2)
			.then(sum => console.log(sum))
	})

client.connect('ws://localhost:3000')
client.connect('ws://localhost:3001')
```

## Tests

```
npm run test
```

## License

[MIT License](LICENSE)
