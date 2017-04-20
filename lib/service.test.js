/* eslint-env jest */
const Service = require('./service')

test('Sets the service descriptor', () => {
	const service = new Service('testing')
	expect(service.serviceDescriptor).toEqual({
		type: 'service',
		name: 'testing',
		methods: []
	})

	service.type = 'object'
	expect(service.serviceDescriptor).toEqual({
		type: 'object',
		name: 'testing',
		methods: []
	})

	service.register('add', (a, b) => a + b)
	expect(service.serviceDescriptor).toEqual({
		type: 'object',
		name: 'testing',
		methods: ['add']
	})

	service.register('subtract', (a, b) => a - b)
	expect(service.serviceDescriptor).toEqual({
		type: 'object',
		name: 'testing',
		methods: ['add', 'subtract']
	})
})

test('Methods should resolve with cb data and type', () => {
	const service = new Service('testing')
	service.register('add', (a, b) => a + b)
	service.register('timeoutMsg', msg => {
		return new Promise(res => {
			setTimeout(res.bind(null, msg), 200)
		})
	})

	const tests = [
		service.methods.add([1, 2])
			.then(result => {
				expect(result).toEqual({
					type: 'number',
					data: 3
				})
			}),
		service.methods.timeoutMsg(['hello'])
			.then(result => {
				expect(result).toEqual({
					type: 'string',
					data: 'hello'
				})
			})
	]

	return Promise.all(tests)
})

test('Each method is registered with the socket', () => {
	const service = new Service('testing')
	service.register('add', (a, b) => a + b)
	service.register('subtract', (a, b) => a - b)

	const socket = {
		register: jest.fn()
	}

	service.setSocket(socket)
	expect(socket.register.mock.calls.length).toBe(2)
	expect(socket.register.mock.calls[0][0]).toEqual('testing.add')
	expect(socket.register.mock.calls[1][0]).toEqual('testing.subtract')
})