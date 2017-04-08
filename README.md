# Microserv
JSON-RPC over websocket with multicast service discovery.

## Installation
```
npm install --save microserv
```

## Usage

### Client A
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

### Client B
```javascript
const http = require('http')
const { Server } = require('microserv')

const server = new Server('my-app', { port: 3001 })

// Wait for the message service to be ready
server.need('message')
	.then(([ message ]) => {
		const app = http.createServer((req, res) => {
			res.statusCode = 200
			res.setHeader('Content-Type', 'text/plain')

			// Call the message service `getMessage` method
			message.methods.getMessage()
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

## License

[MIT License](LICENSE)