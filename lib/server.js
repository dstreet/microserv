const discovery = require('dns-discovery')
const rpc = require('rpc-websockets')
const { EventEmitter } = require('events')
const Client = require('./client')
const debug = require('debug')('microserv')
const { SERVICES_METHOD, ADD_SERVICE_EVENT, SERVICE_EVENT } = require('./constants')

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
		this.rpcServer.register(SERVICES_METHOD, () => {
			return this.services.reduce((acc, service) => {
				return Object.assign({}, acc, { [service.name]: service.serviceDescriptor })
			}, {})
		})
		this.rpcServer.event(ADD_SERVICE_EVENT)
		this.rpcServer.event(SERVICE_EVENT)
		
		this.rpcServer.on('error', this.emit.bind(this, 'error'))

		this.client = new Client({ serviceTransform: this.opts.serviceTransform })
		this.client.on('error', err => this.emit('error', err))

		this.services = []
		this.knownPeers = []
	}

	addService(service) {
		service.setSocket(this.rpcServer)
		this.services.push(service)

		if (this.started) {
			debug('Adding new service:', service.name)
			this.rpcServer.emit(ADD_SERVICE_EVENT, { [service.name]: service.serviceDescriptor })
		}

		return this
	}

	need(...services) {
		return this.client.need.apply(this.client, services)
	}

	listen() {
		this.dns.on('peer', this._onPeerCallback.bind(this))

		return this
	}

	announce() {
		this.started = true
		setInterval(() => {
			this.dns.announce(this.namespace, this.opts.port || this.opts.server.address().port)
		}, this.opts.interval)

		return this
	}

	_onPeerCallback(namespace, peer) {
		const peerId = `${peer.host}:${peer.port}`

		if (this.knownPeers.indexOf(peerId)+1) return
		this.knownPeers.push(peerId)

		debug('Found new peer:', peerId)
		if (namespace !== this.namespace) return
		
		const ws = this.client.connect(`${this.opts.secure ? 'wss' : 'ws'}://${peer.host}:${peer.port}`)
		ws.on('close', () => {
			// Remove the peer so that we can find it again
			this.knownPeers.splice(this.knownPeers.indexOf(peerId), 1)
		})
	}
}

module.exports = Server