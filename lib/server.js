const discovery = require('dns-discovery')
const rpc = require('rpc-websockets')
const events = require('events')

const constants = {
	SERVICES_METHOD: '__services__',
	ADD_SERVICE_EVENT: '__add_service__'
}

class Server extends events.EventEmitter {
	constructor(namespace, port, opts) {
		super()
		this.namespace = namespace
		this.port = port
		this.opts = Object.assign({}, opts, {
			interval: 5000
		})
		this.started = false

		this.dns = discovery()
		this.rpcServer = new rpc.Server({ port })
		this.rpcServer.register(constants.SERVICES_METHOD, () => {
			return this.services.reduce((acc, service) => {
				return Object.assign({}, acc, { [service.name]: Object.keys(service.methods) })
			}, {})
		})
		this.rpcServer.event(constants.ADD_SERVICE_EVENT)

		this.rpcServer.on('error', this.emit.bind(this, 'error'))

		this.requiredServices = {}
		this.foundServices = {}
		this.services = []
		this.knownPeers = []
	}

	addService(service) {
		service.setSocket(this.rpcServer)
		this.services.push(service)

		if (this.started) {
			console.log('adding new service', service.name)
			this.rpcServer.emit('addService', { [service.name]: Object.keys(service.methods) })
		}

		return this
	}

	need(...services) {
		const promises = services.map(service => {
			if (service in this.foundServices) {
				return Promise.resolve(
					this._getClientService(this.foundServices[service].ws, service, this.foundServices[service].methods)
				)
			}

			return new Promise(res => {
				const cb = (ws, methods) => {
					res(this._getClientService(ws, service, methods))
				}
				
				this.requiredServices[service] = cb
			})
		})

		return Promise.all(promises)
	}

	listen() {
		this.dns.on('peer', this._onPeerCallback.bind(this))
	}

	announce() {
		this.started = true
		setInterval(() => {
			this.dns.announce(this.namespace, this.port)
		}, this.opts.interval)
	}

	_getClientService(ws, name, methods) {
		return methods.reduce((acc, key) => {
			return Object.assign({}, acc, {
				[key]: (...args) => ws.call(`${name}.${key}`, args)
			})
		}, {})
	}

	_onPeerCallback(namespace, peer) {
		const peerId = `${peer.host}:${peer.port}`

		if (this.knownPeers.indexOf(peerId)+1) return
		this.knownPeers.push(peerId)

		console.log('found new peer')
		if (namespace !== this.namespace) return
		
		const ws = new rpc.Client(`ws://${peer.host}:${peer.port}`)
		ws.on('open', this._onConnectCallback(ws))
		ws.on('close', this.emit.bind(this, 'close'))
		ws.on('error', this.emit.bind(this, 'error'))
	}

	_onConnectCallback(ws) {
		return () => {
			console.log('Connected to websocket...')
			ws.call(constants.SERVICES_METHOD)
				.then(clientServices => {
					this._checkClientServices(clientServices, ws)
				})
				.catch(console.log.bind(console))

			ws.subscribe(constants.ADD_SERVICE_EVENT)
			ws.on(constants.ADD_SERVICE_EVENT, service => this._checkClientServices(service, ws))
		}
	}

	_checkClientServices(clientServices, ws) {
		Object.keys(clientServices).forEach(key => {
			if (key in this.requiredServices) {
				console.log('Found service', key)
				this.requiredServices[key](ws, clientServices[key])
			} else {
				console.log('Store service', key)
				this.foundServices[key] = { ws, methods: clientServices[key] }
			}
		})
	}
}

module.exports = Server