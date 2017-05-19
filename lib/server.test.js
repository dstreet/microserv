/* eslint-env jest */
const Server = require('./server')
const Service = require('./service')
const discovery = require('dns-discovery')
const http = require('http')

function getHttpServer() {
	const httpServer = http.createServer()
	
	return new Promise(res => {
		httpServer.listen(() => {
			res(httpServer)
		})
	})
}

test('Server announces itself', () => {
	return getHttpServer()
		.then(httpServer => {
			const listener = discovery(true)

			const server = new Server('test', { server: httpServer, interval: 100 })
			server.on('error', () => {})
			server.listen()
			server.announce()

			return new Promise(res => {
				listener.once('peer', (name, peer) => {
					expect(peer.port).toBe(httpServer.address().port)
					httpServer.close(res)
				})
			})
		})
})

test('Server should listen for other services with the same namespace', () => {
	return Promise.all([getHttpServer(), getHttpServer()])
		.then(([httpA, httpB]) => {
			const serverA = new Server('test', { server: httpA, interval: 100 })
			const serverB = new Server('test', { server: httpB, interval: 100 })
			serverA.on('error', () => {})
			serverB.on('error', () => {})

			const promise = serverA.need('service_a')
				.then(() => {
					httpA.close()
					httpB.close()
				}) 

			serverA.listen()
			serverA.announce()

			const serviceA = new Service('service_a')
			serverB.addService(serviceA)
			serverB.listen()
			serverB.announce()

			return promise
		})
})

test('Server should not listen on other namespaces', () => {
	return Promise.all([getHttpServer(), getHttpServer()])
		.then(([httpA, httpB]) => {
			const serverA = new Server('test', { server: httpA, interval: 100 })
			const serverB = new Server('test-b', { server: httpB, interval: 100 })
			serverA.on('error', () => {})
			serverB.on('error', () => {})

			const promise = serverA.need('service_a')
				.then(() => 'fail')

			serverA.listen()
			serverA.announce()

			const serviceA = new Service('service_a')
			serverB.addService(serviceA)
			serverB.listen()
			serverB.announce()

			return Promise.race([
				promise,
				new Promise(res => setTimeout(res.bind(null, 'pass'), 4000))
			]).then(res => {
				expect(res).toBe('pass')
			})
		})
})

test('Server should emit an event when a new service is added', () => {
	return Promise.all([getHttpServer(), getHttpServer()])
		.then(([httpA, httpB]) => {
			const serverA = new Server('test', { server: httpA, interval: 100 })
			const serverB = new Server('test', { server: httpB, interval: 100 })
			serverA.on('error', () => {})
			serverB.on('error', () => {})

			const promise = serverA.need('service_a')
				.then(() => {
					httpA.close()
					httpB.close()
				}) 

			serverA.listen()
			serverA.announce()

			serverB.listen()
			serverB.announce()

			const serviceA = new Service('service_a')
			serverB.addService(serviceA)

			return promise
		})
})

test('Server should emit an event when a service goes offline', () => {
	return Promise.all([getHttpServer(), getHttpServer()])
		.then(([httpA, httpB]) => {
			const serverA = new Server('test', { server: httpA, interval: 100 })
			const serverB = new Server('test', { server: httpB, interval: 100 })
			serverA.on('error', () => {})
			serverB.on('error', () => {})

			const promise = serverA.need('service_a')
				.then(([service_a]) => {
					const prom =  new Promise(res => {
						service_a.on('close', res())
					})

					serverB.rpcServer.close()

					return prom
				}) 
				.then(() => {
					httpA.close()
					httpB.close()
				})

			serverA.listen()
			serverA.announce()

			const serviceA = new Service('service_a')
			serverB.addService(serviceA)
			serverB.listen()
			serverB.announce()

			return promise
		})
})

test('Server should emit an event when a service comes back online', () => {
	return Promise.all([getHttpServer(), getHttpServer()])
		.then(([httpA, httpB]) => {
			const serverA = new Server('test', { server: httpA, interval: 100 })
			const serverB = new Server('test', { server: httpB, interval: 100 })
			serverA.on('error', () => {})
			serverB.on('error', () => {})

			const promise = serverA.need('service_a')
				.then(([service_a]) => {
					const prom =  new Promise(res => {
						service_a.on('close', res.bind(null, service_a))
					})

					serverB.rpcServer.close()

					return prom
				})
				.then(service_a => {
					const prom = new Promise(res => {
						service_a.on('reopen', () => {
							res()
						})
					})

					const serverB2 = new Server('test', { server: httpB, interval: 100 })
					serverB2.on('error', () => {})
					const serviceA = new Service('service_a')
					serverB2.addService(serviceA)
					serverB2.listen()
					serverB2.announce()

					return prom
				})
				.then(() => {
					httpA.close()
					httpB.close()
				})

			serverA.listen()
			serverA.announce()

			const serviceA = new Service('service_a')
			serverB.addService(serviceA)
			serverB.listen()
			serverB.announce()

			return promise
		})
})