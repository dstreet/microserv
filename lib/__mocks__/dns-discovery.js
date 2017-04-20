const { EventEmitter } = require('events')

const instances = []

module.exports = () => {
	const d = new DiscoveryFoo()
	instances.push(d)
	return d
}

class DiscoveryFoo extends EventEmitter {
	constructor(noRepeat) {
		super()
		this.announced = false
		this.noRepeat = noRepeat
	}

	announce(namespace, port) {
		if (this.noRepeat && this.announced) return this
		this.announced = true
		instances.forEach(d => {
			d.emit('peer', namespace, { host: 'localhost', port })
		})
		return this
	}
}