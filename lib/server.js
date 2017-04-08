const discovery = require('dns-discovery')
const rpc = require('rpc-websockets')
const events = require('events')

class Server extends events.EventEmitter {
	constructor(namespace, port, opts) {
		super()
		this.namespace = namespace
		this.port = port
		this.opts = Object.assign({}, opts, {
			interval: 5000
		})

		this.dns = discovery()
		this.rpcServer = new rpc.Server({ port })
		this.rpcServer.register('__services__', () => {
			return this.services.reduce((acc, service) => {
				return Object.assign({}, acc, { [service.name]: Object.keys(service.methods) })
			}, {})
		})

		this.rpcServer.on('error', this.emit.bind(this, 'error'))

		this.requiredServices = {}
		this.services = []
		this.knownPeers = []
	}

	addService(service) {
		service.setSocket(this.rpcServer)
		this.services.push(service)
		return this
	}

	need(...services) {
		const promises = services.map(service => {
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
			ws.call('__services__')
				.then(clientServices => {
					Object.keys(clientServices).forEach(key => {
						if (key in this.requiredServices) {
							console.log('Found service', key)
							this.requiredServices[key](ws, clientServices[key])
						}
					})
				})
				.catch(console.log.bind(console))
		}
	}
}

module.exports = Server