const { EventEmitter } = require('events')

class ClientService extends EventEmitter {
	constructor(ws, descriptor, opts) {
		super()
		this.ws = ws
		this.descriptor = descriptor
		this.opts = Object.assign({}, {
			serviceTransform: data => data
		}, opts)

		this._applyMethods()
	}

	_applyMethods() {
		this.descriptor.methods.forEach(key => {
			this[key] = (...args) => this.ws.call(`${this.descriptor.name}.${key}`, args).then(this.opts.serviceTransform)
		})
	}
}

module.exports = ClientService