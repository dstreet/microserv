const discovery = require('dns-discovery')
const rpc = require('rpc-websockets')
const { EventEmitter } = require('events')
const ClientService = require('./client-service')

const constants = {
	SERVICES_METHOD: '__services__',
	ADD_SERVICE_EVENT: '__add_service__'
}

class Server extends EventEmitter {
	constructor(namespace, opts) {
		super()
		this.namespace = namespace
		this.opts = Object.assign({}, {
			port: null,
			interval: 5000,
			serviceTransform: data => data,
			server: null,
			secure: false
		}, opts)
		this.started = false

		this.dns = discovery()
		this.rpcServer = new rpc.Server(this.opts.server ? { server: this.opts.server } : { port: this.opts.port })
		this.rpcServer.register(constants.SERVICES_METHOD, () => {
			return this.services.reduce((acc, service) => {
				return Object.assign({}, acc, { [service.name]: service.serviceDescriptor })
			}, {})
		})
		this.rpcServer.event(constants.ADD_SERVICE_EVENT)

		this.rpcServer.on('error', this.emit.bind(this, 'error'))

		this.requiredServices = []
		this.foundServices = {}
		this.services = []
		this.knownPeers = []
	}

	addService(service) {
		service.setSocket(this.rpcServer)
		this.services.push(service)

		if (this.started) {
			console.log('adding new service', service.name)
			this.rpcServer.emit(constants.ADD_SERVICE_EVENT, { [service.name]: service.serviceDescriptor })
		}

		return this
	}

	need(...services) {
		const promises = services.map(service => {
			if (service in this.foundServices) {
				return Promise.resolve(this.foundServices[service])
			}

			return new Promise(res => {
				const cb = clientService => res(clientService)
				
				this.requiredServices.push({ name: service, cb })
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
			this.dns.announce(this.namespace, this.opts.port || this.opts.server.address().port)
		}, this.opts.interval)
	}

	_onPeerCallback(namespace, peer) {
		const peerId = `${peer.host}:${peer.port}`

		if (this.knownPeers.indexOf(peerId)+1) return
		this.knownPeers.push(peerId)

		console.log('found new peer', peerId)
		if (namespace !== this.namespace) return
		
		const ws = new rpc.Client(`${this.opts.secure ? 'wss' : 'ws'}://${peer.host}:${peer.port}`)
		ws.on('open', this._onConnectCallback(ws))
		ws.on('close', code => {
			const lostServices = Object.keys(this.foundServices)
				.filter(key => this.foundServices[key].ws === ws)
				.map(key => this.foundServices[key])

			// Emit close event for each lost service
			lostServices.forEach(service => service.emit('close'))

			// Emit close event for the server
			this.emit('close', code, lostServices.map(service => service.descriptor.name))

			// Remove the peer so that we can find it again
			this.knownPeers.splice(this.knownPeers.indexOf(peerId), 1)
		})
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
			console.log('Store service', key)
			if (key in this.foundServices) {
				this.foundServices[key].ws = ws
				this.foundServices[key].emit('reopen')
				return
			}

			const service = new ClientService(ws, clientServices[key], { serviceTransform: this.opts.serviceTransform })
			this.foundServices[key] = service

			this.requiredServices
				.filter(s => s.name === key)
				.forEach(s => {
					console.log('Found service', s.name)
					s.cb(service)
				})
		})
	}
}

module.exports = Server