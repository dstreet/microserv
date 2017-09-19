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

## Server

```javascript
const server = new Server('my-app', { port: 3001 })
```

### new Server(namespace[,options]) -> Client

Instantiate a client

Parameters:
* `address` {String}: The service namespace. Only services in the same namespace can connect to each other.
* `options` {Object}: Websocket options
	* `port` {Number}: Websocket port
	* `interval` {Number}: How often to announce the service (in ms). Defaults to `5000`.
	* `sever` {http.Server|https.server}: A server to use as the websocket server. If set, will override `port`.
	* `secure` {Boolean}: Use secure websockets. Defaults to `false`.
	* `serviceTransform` {Function}: A function to transform the data returned from an rpc call. Defaults to noop.
	* `authorization` {Any}: Credentials to pass to Server when connecting
	* `authorizeClient` {Function}: A sync or async function to authorize a Client. Function is passed the Client's `authorization` credentials
	* `dns` {Object}: [dns-discovery](https://github.com/mafintosh/dns-discovery) options

### server.addService(service) -> Server

Add a service to the server, and announce the service to connected peers

Parameters:
* `service` {Service}: A Service instance

### server.need(...services) -> Promise

List required services. Resolves with each of the required services of type ClientService

Parameters:
* `services` {String}: Service names

### server.listen() -> Server

Begin listening for peers

### server.announce() -> Server

Announce the service on the network. Will reannounce the service at the interval provided via `opts`.

### Event: 'error'


## Service

```javascript
const service = new Service('my-service')
```

### new Service(name) -> Service

Instantiate a new Service

Parameters:
* `name` {String}: The service name that will be announced to peers

### service.register(method, cb[, resultType]) -> Service

Register an rpc method with the service

Parameters:
* `method` {String}: The name of the method
* `cb` {Function}: The function to invoke when the rpc method is called
* `resultType` {String}: The type of data returned by the method. Defaults to `typeof result`

### service.emit(name, data)

Emits an event via the websocket

Parameters:
* `name` {String}: The event name
* `data` {*}: The event data


## ClientService

Returned from `server.need()`. This should not be instantiated direclty.

### clientService.subscribe(name, cb)

Subscribe to a service event

Parameters:
* `name` {String}: The name of the event
* `cb` {Function}: The event callback

### clientService.service_method(*) -> Object

Each method registered with the service is exposed a method of the client service. Returns and object with `data` and `type` properties.

### Event: 'close'

Emitted when the connection to the service is lost

### Event: 'reopen'

Emitted when the connection to a lost service is reestablished


## Client

```javascript
const client = new Client()
```

### new Client([opts, rpcOpts]) -> Client

Instantiate a new Client

Parameters:
* `opts` {Object}: Options
	* `serviceTransform` {Function}: A function to transform the data returned from an rpc call. Defaults to noop.
	* `authorization` {Any}: Credentials to pass to Server when connecting
* `rpcOpts` {Object}: Options for [rpc-websockets](https://github.com/qaap/rpc-websockets)

### client.connect(connection) -> Websocket

Connect to a specific websocket server

Parameters:
* `connection` {String}: The server connection string (eg. ws://localhost:3001)

### client.need(...service) -> Promise

List required services. Resolves with each of the required services of type ClientService

Parameters:
* `services` {String}: Service names

### Event: 'close'

Emitted when the connection to a service is closed

### Event: 'error'

### Event: 'unauthorized'

Emitted when the client fails authorization


## Tests

```
npm run test
```

## License

[MIT License](LICENSE)
