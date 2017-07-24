const { SERVICE_EVENT } = require('./constants')
const debug = require('debug')('microserv')

class Service {
	constructor(serviceName, opts) {
		this.name = serviceName
		this.opts = opts || {}
		this.type = 'service'
		this._sockets = []

		this.methods = {}
	}

	get serviceDescriptor() {
		return {
			type: this.type,
			name: this.name,
			methods: Object.keys(this.methods)
		}
	}

	register(method, cb, resultType) {
		this.methods[method] = param => {
			let promise
			
			if (Array.isArray(param)) {
				promise = Promise.resolve(cb.apply(null, param))
			} else {
				promise = Promise.resolve(cb(param))
			}

			return promise
				.then(result => {
					return {
						type: resultType || typeof result,
						data: result
					}
				})
		}

		return this
	}

	emit(name, data) {
		if (!this._sockets.length) return
		
		debug(`service: ${this.name}, emitting: ${name}`)
		this._sockets.forEach(socket => {
			socket.emit(SERVICE_EVENT, { name, data })
		})
	}

	addSocket(socket) {
		Object.keys(this.methods).forEach(key => {
			socket.register(`${this.name}.${key}`, this.methods[key])
		})

		this._sockets.push(socket)
	}
}

module.exports = Service