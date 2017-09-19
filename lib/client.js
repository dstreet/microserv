const { EventEmitter } = require('events')
const rpc = require('rpc-websockets')
const debug = require('debug')('microserv:client')
const ClientService = require('./client-service')
const { SERVICES_METHOD, AUTHORIZE_METHOD, ADD_SERVICE_EVENT, SERVICE_EVENT } = require('./constants')

class Client extends EventEmitter {
	constructor(opts, rpcOpts) {
		super()
		this.opts = Object.assign({}, {
			serviceTransform: data => data
		}, opts)
		this.rpcOpts = rpcOpts
		this.connections = []
		this.requiredServices = []
		this.foundServices = {}
		this._rejectedConnections = []
	}

	isRejectedConnection(ws) {
		return this._rejectedConnections.indexOf(ws) + 1
	}

	connect(connection) {
		const ws = new rpc.Client(connection, this.rpcOpts)
		ws.on('open', this._onConnectCallback(ws))
		ws.on('close', code => {
			const lostServices = Object.keys(this.foundServices)
				.filter(key => this.foundServices[key].ws === ws)
				.map(key => this.foundServices[key])

			// Emit close event for each lost service
			lostServices.forEach(service => service.emit('close'))

			// Emit close event for the server
			this.emit('close', code, lostServices.map(service => service.descriptor.name))
		})
		ws.on('error', this.emit.bind(this, 'error'))

		return ws
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

	_onConnectCallback(ws) {
		return () => {
			debug('Connected to websocket')
			ws.call(AUTHORIZE_METHOD, [this.opts.authorization])
				.then(() => {
					debug('Authorization successful')
					return
				})
				.then(() => {
					ws.call(SERVICES_METHOD)
						.then(clientServices => {
							this._checkClientServices(clientServices, ws)
						})
						.catch(err => debug(err))

					ws.subscribe(ADD_SERVICE_EVENT)
					ws.on(ADD_SERVICE_EVENT, service => this._checkClientServices(service, ws))
					ws.subscribe(SERVICE_EVENT)
				})
				.catch(err => {
					debug(err)
					this.emit('unauthorized')
					this._rejectedConnections.push(ws)
					ws.close()
				})
		}
	}

	_checkClientServices(clientServices, ws) {
		Object.keys(clientServices).forEach(key => {
			debug('Store service:', key)
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
					debug('Found service:', s.name)
					s.cb(service)
				})
		})
	}
}

module.exports = Client
