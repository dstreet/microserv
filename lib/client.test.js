/* eslint-env jest */
const Server = require('./server')
const Service = require('./service')
const Client = require('./client')
const http = require('http')

function getHttpServer() {
	const httpServer = http.createServer()
	
	return new Promise(res => {
		httpServer.listen(() => {
			res(httpServer)
		})
	})
}

test('Client services are returned when needed by the client', () => {
	return getHttpServer()
		.then(httpServer => {
			const server = new Server('test', { server: httpServer, interval: 100 })
			server.on('error', () => {})

			const service = new Service('service_test')
			service.register('test_a', () => {})
			service.register('test_b', () => {})
			server.addService(service)

			const client = new Client()
			client.connect(`ws://localhost:${httpServer.address().port}`)
			
			return client.need('service_test')
				.then(([ serviceTest ]) => {
					expect(serviceTest).toHaveProperty('test_a')
					expect(serviceTest).toHaveProperty('test_b')
					httpServer.close()
				})
		})
})

test('Can connect to multiple servers', () => {
	return Promise.all([ getHttpServer(), getHttpServer() ])
		.then(([ httpA, httpB ]) => {
			const serverA = new Server('test', { server: httpA, interval: 100 })
			const serverB = new Server('test', { server: httpB, interval: 100 })

			serverA.on('error', () => {})
			serverB.on('error', () => {})

			const mockA = jest.fn((a, b) => a + b)
			const mockB = jest.fn()

			const serviceA = new Service('service_a')
			serviceA.register('test_a', mockA)
			serverA.addService(serviceA)

			const serviceB = new Service('service_b')
			serviceB.register('test_b', mockB)
			serverB.addService(serviceB)

			const client = new Client()
			client.connect(`ws://localhost:${httpA.address().port}`)
			client.connect(`ws://localhost:${httpB.address().port}`)
			
			return client.need('service_a', 'service_b')
				.then(([ serviceTestA, serviceTestB ]) => {
					expect(serviceTestA).toHaveProperty('test_a')
					expect(serviceTestB).toHaveProperty('test_b')

					return Promise.all([
						serviceTestA.test_a(1, 2),
						serviceTestB.test_b()
					])
				})
				.then(results => {
					expect(results[0]).toEqual({ data: 3, type: 'number' })
					expect(mockA.mock.calls).toHaveLength(1)
					expect(mockB.mock.calls).toHaveLength(1)
					httpA.close()
					httpB.close()
				})
		})
})