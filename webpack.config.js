const path = require('path')

module.exports = {
	target: 'web',
	entry: {
		'index.browser': './index.browser.js'
	},
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'dist'),
		library: 'microserv',
		libraryTarget: 'umd'
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: [/node_modules/],
				use: [{
					loader: 'babel-loader',
					options: {
						presets: ['stage-3', 'es2015']
					}
				}]
			}
		]
	}
}
