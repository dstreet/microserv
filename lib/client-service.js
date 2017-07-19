const { EventEmitter } = require('events')
const { SERVICE_EVENT } = require('./constants')

class ClientService extends EventEmitter {
	constructor(ws, descriptor, opts) {
		super()
		this.ws = ws
		this.descriptor = descriptor
		this.opts = Object.assign({}, {
			serviceTransform: data => data
		}, opts)
		this.events = []

		this._applyMethods()
	}

	get ws() {
		return this._ws
	}

	set ws(ws) {
		if (this._ws) this._ws.off(SERVICE_EVENT)
		this._ws = ws
		this._ws.on(SERVICE_EVENT, this._serviceEventCallback.bind(this))
	}

	subscribe(name, cb) {
		this.on(name, cb)
	}

	_applyMethods() {
		this.descriptor.methods.forEach(key => {
			this[key] = (...args) => this.ws.call(`${this.descriptor.name}.${key}`, args).then(this.opts.serviceTransform)
		})
	}

	_serviceEventCallback({ name, data }) {
		this.emit(name, data)
	}
}

module.exports = ClientService