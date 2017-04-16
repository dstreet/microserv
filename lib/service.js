class Service {
	constructor(serviceName, opts) {
		this.name = serviceName
		this.opts = opts || {}
		this.type = 'service'

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

	setSocket(socket) {
		this._socket = socket

		Object.keys(this.methods).forEach(key => {
			this._socket.register(`${this.name}.${key}`, this.methods[key])
		})
	}
}

module.exports = Service