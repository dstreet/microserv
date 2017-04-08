class Service {
	constructor(serviceName, opts) {
		this.serviceName = serviceName
		this.opts = opts || {}

		this.methods = {}
	}

	get name() {
		return this.serviceName
	}

	register(method, cb) {
		this.methods[method] = param => {
			if (Array.isArray(param)) {
				return cb.apply(null, param)
			}

			return cb(param)
		}

		return this
	}

	setSocket(socket) {
		this._socket = socket

		Object.keys(this.methods).forEach(key => {
			this._socket.register(`${this.serviceName}.${key}`, this.methods[key])
		})
	}
}

module.exports = Service