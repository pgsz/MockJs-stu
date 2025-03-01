/*
	## Parser

	解析数据模板（属性名部分）。
	通过正则解析和数据判断之后，将其返回

	* Parser.parse( name )
		
		```json
		{
			parameters: [ name, inc, range, decimal ],
			rnage: [ min , max ],

			min: min,
			max: max,
			count : count,

			decimal: decimal,
			dmin: dmin,
			dmax: dmax,
			dcount: dcount
		}
		```
 */

var Constant = require('./constant')
var Random = require('./random/')

/* jshint -W041 */
module.exports = {
	parse: function (name) {
		name = name == undefined ? '' : (name + '')

		/**
		 * name = 'number|1-10.1-2'
		 * parameters = ['number|1-10.1-2', 'number', undefined, '1-10', '1-2', index: 0, input: 'number|1-10.1-2', groups: undefined]
		*/
		var parameters = (name || '').match(Constant.RE_KEY)

		/**
		 * 获取 rang  min max
		 * '1-10'
	   *  ['1-10', '1', '10', index: 0, input: '1-10', groups: undefined]
		*/
		var range = parameters && parameters[3] && parameters[3].match(Constant.RE_RANGE)
		var min = range && range[1] && parseInt(range[1], 10) // || 1
		var max = range && range[2] && parseInt(range[2], 10) // || 1
		// repeat || min-max || 1
		// var count = range ? !range[2] && parseInt(range[1], 10) || Random.integer(min, max) : 1
		/**
		 * 三元运算符 获取数据范围  
		 * 即 没有 min max 时返回 undefined
		 * 只有 min count = min
		 * 有 min-max 从中随机取值
		 * if(range) {
		 *  if(!range[2]) {
		 *   count = parseInt(range[1], 10)
		 *  } else {
		 *   count = Random.integer(min, max)
		 *  }
		 * } else {
		 *  count = undefined
		 * }
		*/
		var count = range ? !range[2] ? parseInt(range[1], 10) : Random.integer(min, max) : undefined

		// 获取 decimal  dmin dmax
		var decimal = parameters && parameters[4] && parameters[4].match(Constant.RE_RANGE)
		var dmin = decimal && decimal[1] && parseInt(decimal[1], 10) // || 0,
		var dmax = decimal && decimal[2] && parseInt(decimal[2], 10) // || 0,
		// int || dmin-dmax || 0
		var dcount = decimal ? !decimal[2] && parseInt(decimal[1], 10) || Random.integer(dmin, dmax) : undefined

		var result = {
			// 1 name, 2 inc, 3 range, 4 decimal
			parameters: parameters,
			// 1 min, 2 max
			range: range,
			min: min,
			max: max,
			// min-max
			count: count,
			// 是否有 decimal
			decimal: decimal,
			dmin: dmin,
			dmax: dmax,
			// dmin-dimax
			dcount: dcount
		}

		for (var r in result) {
			if (result[r] != undefined) return result
		}

		return {}
	}
}