/* 
    ## Handler

    处理数据模板。
    
    * Handler.gen( template, name?, context? )

        入口方法。

    * Data Template Definition, DTD
        
        处理数据模板定义。

        * Handler.array( options )
        * Handler.object( options )
        * Handler.number( options )
        * Handler.boolean( options )
        * Handler.string( options )
        * Handler.function( options )
        * Handler.regexp( options )
        
        处理路径（相对和绝对）。

        * Handler.getValueByKeyPath( key, options )

    * Data Placeholder Definition, DPD

        处理数据占位符定义

        * Handler.placeholder( placeholder, context, templateContext, options )

*/

var Constant = require('./constant')
var Util = require('./util')
var Parser = require('./parser')
var Random = require('./random/')
var RE = require('./regexp')

var Handler = {
    extend: Util.extend
}

/*
    template        属性值（即数据模板）
    name            属性名
    context         数据上下文，生成后的数据
    templateContext 模板上下文，

    Handle.gen(template, name, options)
    context
        currentContext, templateCurrentContext, 
        path, templatePath
        root, templateRoot
*/
Handler.gen = function (template, name, context) {
    /* jshint -W041 */
    name = name == undefined ? '' : (name + '')

    context = context || {}
    context = {
        // 当前访问路径，只有属性名，不包括生成规则
        path: context.path || [Constant.GUID],
        templatePath: context.templatePath || [Constant.GUID++],
        // 最终属性值的上下文
        currentContext: context.currentContext,
        // 属性值模板的上下文
        templateCurrentContext: context.templateCurrentContext || template,
        // 最终值的根
        root: context.root || context.currentContext,
        // 模板的根
        templateRoot: context.templateRoot || context.templateCurrentContext || template
    }
    // console.log('path:', context.path.join('.'), template)

    // rule: {
    //     "parameters": [
    //         "number|1-10.1-2",
    //         "number",
    //         null,
    //         "1-10",
    //         "1-2"
    //     ],
    //     "range": [
    //         "1-10",
    //         "1",
    //         "10"
    //     ],
    //     "min": 1,
    //     "max": 10,
    //     "count": 3,
    //     "decimal": [
    //         "1-2",
    //         "1",
    //         "2"
    //     ],
    //     "dmin": 1,
    //     "dmax": 2,
    //     "dcount": 2
    // }
    var rule = Parser.parse(name)
    // 获取 template 的数据类型格式  number | array 等
    var type = Util.type(template)
    var data

    // 针对于 属性值 的类型，进行不同的解析操作
    if (Handler[type]) {
        data = Handler[type]({
            // 属性值类型
            type: type,
            // 属性值模板
            template: template,
            // 属性名 + 生成规则
            name: name,
            // 属性名
            parsedName: name ? name.replace(Constant.RE_KEY, '$1') : name,

            // 解析后的生成规则
            rule: rule,
            // 相关上下文
            context: context
        })

        if (!context.root) context.root = data
        return data
    }

    return template
}

Handler.extend({
    // array
    array: function (options) {
        var result = [],
            i, ii;

        // 'name|1': []
        // 'name|count': []
        // 'name|min-max': []
        // 没有赋值的话
        if (options.template.length === 0) return result

        // 'arr': [{ 'email': '@EMAIL' }, { 'email': '@EMAIL' }]
        if (!options.rule.parameters) {
            // 遍历获取其内容值
            for (i = 0; i < options.template.length; i++) {
                options.context.path.push(i)
                options.context.templatePath.push(i)
                result.push(
                    Handler.gen(options.template[i], i, {
                        path: options.context.path,
                        templatePath: options.context.templatePath,
                        currentContext: result,
                        templateCurrentContext: options.template,
                        root: options.context.root || result,
                        templateRoot: options.context.templateRoot || options.template
                    })
                )
                options.context.path.pop()
                options.context.templatePath.pop()
            }
        } else {
            // 'method|1': ['GET', 'POST', 'HEAD', 'DELETE']
            // 只有一个的情形
            if (options.rule.min === 1 && options.rule.max === undefined) {
                // fix #17
                options.context.path.push(options.name)
                options.context.templatePath.push(options.name)
                result = Random.pick(
                    Handler.gen(options.template, undefined, {
                        path: options.context.path,
                        templatePath: options.context.templatePath,
                        currentContext: result,
                        templateCurrentContext: options.template,
                        root: options.context.root || result,
                        templateRoot: options.context.templateRoot || options.template
                    })
                )
                options.context.path.pop()
                options.context.templatePath.pop()
            } else {
                // 'data|+1': [{}, {}]
                if (options.rule.parameters[2]) {
                    options.template.__order_index = options.template.__order_index || 0

                    options.context.path.push(options.name)
                    options.context.templatePath.push(options.name)
                    result = Handler.gen(options.template, undefined, {
                        path: options.context.path,
                        templatePath: options.context.templatePath,
                        currentContext: result,
                        templateCurrentContext: options.template,
                        root: options.context.root || result,
                        templateRoot: options.context.templateRoot || options.template
                    })[
                        // 余数，确保数据不会超出 length
                        options.template.__order_index % options.template.length
                    ]

                    // 每次 递增 +inc => count
                    options.template.__order_index += +options.rule.parameters[2]

                    options.context.path.pop()
                    options.context.templatePath.pop()

                } else {
                    // 'data|1-10': [{}] || 'data|5': [{}]
                    // options.rule.count min-max 范围内随机生成的
                    for (i = 0; i < options.rule.count; i++) {
                        // 'data|1-10': [{}, {}]
                        for (ii = 0; ii < options.template.length; ii++) {
                            options.context.path.push(result.length)
                            options.context.templatePath.push(ii)
                            result.push(
                                Handler.gen(options.template[ii], result.length, {
                                    path: options.context.path,
                                    templatePath: options.context.templatePath,
                                    currentContext: result,
                                    templateCurrentContext: options.template,
                                    root: options.context.root || result,
                                    templateRoot: options.context.templateRoot || options.template
                                })
                            )
                            options.context.path.pop()
                            options.context.templatePath.pop()
                        }
                    }
                }
            }
        }
        return result
    },
    // Object
    object: function (options) {
        // 初始化的时候 会进来一次，即：
        // Mock.mock({
        //     'object|2': {
        //         '310000': '上海市',
        //         '320000': '江苏省',
        //         '330000': '浙江省',
        //         '340000': '安徽省'
        //     }
        // })

        var result = {},
            keys, fnKeys, key, parsedKey, inc, i;

        // 'obj|min-max': {}
        /* jshint -W041 */
        if (options.rule.min != undefined) {
            // 获取全部对象名 [ "310000", "320000", "330000", "340000" ]
            keys = Util.keys(options.template)
            // 打乱 keys 数组的顺序
            keys = Random.shuffle(keys)
            // 截取其 随机的长度 （只有 min 的时候， count = min）
            keys = keys.slice(0, options.rule.count)
            for (i = 0; i < keys.length; i++) {
                key = keys[i]
                parsedKey = key.replace(Constant.RE_KEY, '$1')
                options.context.path.push(parsedKey)
                options.context.templatePath.push(key)
                // 递归解析
                result[parsedKey] = Handler.gen(options.template[key], key, {
                    path: options.context.path,
                    templatePath: options.context.templatePath,
                    currentContext: result,
                    templateCurrentContext: options.template,
                    root: options.context.root || result,
                    templateRoot: options.context.templateRoot || options.template
                })
                options.context.path.pop()
                options.context.templatePath.pop()
            }

        } else {
            // 'obj': {}
            keys = []
            fnKeys = [] // #25 改变了非函数属性的顺序，查找起来不方便
            for (key in options.template) {
                (typeof options.template[key] === 'function' ? fnKeys : keys).push(key)
            }
            keys = keys.concat(fnKeys)

            /*
                会改变非函数属性的顺序
                keys = Util.keys(options.template)
                keys.sort(function(a, b) {
                    var afn = typeof options.template[a] === 'function'
                    var bfn = typeof options.template[b] === 'function'
                    if (afn === bfn) return 0
                    if (afn && !bfn) return 1
                    if (!afn && bfn) return -1
                })
            */

            for (i = 0; i < keys.length; i++) {
                // 'number|1-10.1-2' |  'object|3' : {xxxxx}
                key = keys[i]
                // number | object  $1 表示第一个捕获组的内容  即 | 前面的内容
                parsedKey = key.replace(Constant.RE_KEY, '$1')
                // 处理后的 属性名 和 原始属性名分别推入 上下文路径中
                options.context.path.push(parsedKey)
                options.context.templatePath.push(key)
                // 递归 进行解析
                result[parsedKey] = Handler.gen(options.template[key], key, {
                    path: options.context.path,
                    templatePath: options.context.templatePath,
                    currentContext: result,
                    templateCurrentContext: options.template,
                    root: options.context.root || result,
                    templateRoot: options.context.templateRoot || options.template
                })
                // 处理完之后 删除其属性，恢复原路径
                options.context.path.pop()
                options.context.templatePath.pop()
                // 'id|+1': 1   对于 +number 的值是 number 类型的数据
                inc = key.match(Constant.RE_KEY)
                if (inc && inc[2] && Util.type(options.template[key]) === 'number') {
                    // 进行存储操作，后续调用时确保 递增
                    options.template[key] += parseInt(inc[2], 10)
                }
            }
        }
        return result
    },
    // Number
    number: function (options) {
        // options: name: 'number|1-10.1-2', template: 1
        var result, parts;
        // 如果存在小数点
        if (options.rule.decimal) { // float
            options.template += ''
            parts = options.template.split('.')
            // 'float1|.1-10': 10,
            // 'float2|1-100.1-10': 1,
            // 'float3|999.1-10': 1,
            // 'float4|.3-10': 123.123,
            // 小数点前面的数： 有 rang 则使用 随机的 count， 没有则使用 默认书写的 
            parts[0] = options.rule.range ? options.rule.count : parts[0]
            // 如果默认有小数，则获取 其前随机的dcount 数
            parts[1] = (parts[1] || '').slice(0, options.rule.dcount)
            // 如果默认的小数点没有随机的多，则进行自动添加； 也就是：默认的小数点不会改变
            // eg： 1.111    小数点后面就是 111xxx
            while (parts[1].length < options.rule.dcount) {
                parts[1] += (
                    // 最后一位不能为 0：如果最后一位为 0，会被 JS 引擎忽略掉。
                    // Random.character('number') 0-9
                    (parts[1].length < options.rule.dcount - 1) ? Random.character('number') : Random.character('123456789')
                )
            }
            // 合起来  形成一个完整的数
            result = parseFloat(parts.join('.'), 10)
        } else { // integer
            // 没有小数点的情况
            // 'grade1|1-100': 1,
            // 有 min - max  则返回随机的 count ，否则就是默认的
            result = options.rule.range && !options.rule.parameters[2] ? options.rule.count : options.template
        }
        return result
    },
    // boolean
    boolean: function (options) {
        var result;
        // 'prop|multiple': false, 当前值是相反值的概率倍数
        // 'prop|probability-probability': false, 当前值与相反值的概率
        result = options.rule.parameters ? Random.bool(options.rule.min, options.rule.max, options.template) : options.template
        return result
    },
    // string
    string: function (options) {
        var result = '',
            i, placeholders, ph, phed;
        // 如果有默认值 
        if (options.template.length) {

            //  'foo': '★',
            /* jshint -W041 */
            // 如果没有 count   就返回默认值
            if (options.rule.count == undefined) {
                result += options.template
            }

            // 'star|1-5': '★',
            // count 在 Parser.parse 中已 随机计算出
            for (i = 0; i < options.rule.count; i++) {
                result += options.template
            }
            // 重点： 处理 数据占位符 DPD
            // 'email|1-10': '@EMAIL, ',
            // @float(60, 100, 3, 5) => ["@float(60, 100, 3, 5)"]  正则中有 g
            placeholders = result.match(Constant.RE_PLACEHOLDER) || [] // A-Z_0-9 > \w_
            for (i = 0; i < placeholders.length; i++) {
                ph = placeholders[i]

                // 遇到转义斜杠，不需要解析占位符
                if (/^\\/.test(ph)) {
                    placeholders.splice(i--, 1)
                    continue
                }

                // 获取 解析占位符值 之后的结果
                phed = Handler.placeholder(ph, options.context.currentContext, options.context.templateCurrentContext, options)

                // 只有一个占位符，并且没有其他字符
                if (placeholders.length === 1 && ph === result && typeof phed !== typeof result) { // 
                    result = phed
                    break
                    // todo: 前面break啦， 后面的代码永远不会执行下去
                    if (Util.isNumeric(phed)) {
                        result = parseFloat(phed, 10)
                        break
                    }
                    if (/^(true|false)$/.test(phed)) {
                        result = phed === 'true' ? true :
                            phed === 'false' ? false :
                                phed // 已经是布尔值
                        break
                    }
                }
                // 多个 占位符 的时候，替换对应位置占位符的值  
                // '@float(10, 100, 3, 5) - @cname'
                result = result.replace(ph, phed)
            }

        } else {
            // 如果没有复制默认值的话  即 'string|1-10': ''
            // 'ASCII|1-10': '',
            // 'ASCII': '',
            // options.rule.range： 1-10   随机生成  没有的话就返回 ''
            result = options.rule.range ? Random.string(options.rule.count) : options.template
        }
        return result
    },
    'function': function (options) {
        // ( context, options )
        // 执行此函数 返回结果
        return options.template.call(options.context.currentContext, options)
    },
    'regexp': function (options) {
        var source = ''

        // 'name': /regexp/,
        /* jshint -W041 */
        if (options.rule.count == undefined) {
            source += options.template.source // regexp.source
        }

        // 'name|1-5': /regexp/,
        for (var i = 0; i < options.rule.count; i++) {
            // /regexp//regexp//regexp/
            source += options.template.source
        }

        // TODO: 执行 正则 的方法 进行解析   -   里面比较复杂，先忽略
        return RE.Handler.gen(
            RE.Parser.parse(
                source
            )
        )
    }
})

Handler.extend({
    // 返回 Random 中所有的 key { boolean: "boolean", cfirst: 'cfirst', integer: 'integer', .... }
    _all: function () {
        var re = {};
        for (var key in Random) re[key.toLowerCase()] = key
        return re
    },
    // 处理占位符，转换为最终值
    placeholder: function (placeholder, obj, templateContext, options) {
        // console.log(options.context.path)
        // 1 key, 2 params
        Constant.RE_PLACEHOLDER.exec('')
        // ['@float(60, 100, 3, 5)', 'float', '60, 100, 3, 5', index: 0, input: '@float(60, 100, 3, 5)', groups: undefined]
        var parts = Constant.RE_PLACEHOLDER.exec(placeholder),
            // 即使是 相对或绝对路径  @也不会捕获   float、/unmber、../number
            key = parts && parts[1],
            lkey = key && key.toLowerCase(),
            okey = this._all()[lkey],
            // 携带的参数 即 | 后面的
            params = parts && parts[2] || ''

        // 获取 key 路径  [float]
        var pathParts = this.splitPathToArray(key)

        // 解析占位符的参数
        try {
            // 1. 尝试保持参数的类型
            /*
                #24 [Window Firefox 30.0 引用 占位符 抛错](https://github.com/nuysoft/Mock/issues/24)
                [BX9056: 各浏览器下 window.eval 方法的执行上下文存在差异](http://www.w3help.org/zh-cn/causes/BX9056)
                应该属于 Window Firefox 30.0 的 BUG
            */
            /* jshint -W061 */
            // 将参数字符串转换为数组
            // 1. 使用 eval 动态执行一个函数
            // 2. 该函数接收参数并立即调用
            // 3. 使用 [].splice.call(arguments, 0) 将 arguments 类数组对象转换为真正的数组
            // 4. 最终将 params 字符串解析为数组
            // '60, 100, 3, 5' => ['60', '100', '3', '5']
            params = eval('(function(){ return [].splice.call(arguments, 0 ) })(' + params + ')')
        } catch (error) {
            // 2. 如果失败，只能解析为字符串
            // console.error(error)
            // if (error instanceof ReferenceError) params = parts[2].split(/,\s*/);
            // else throw error
            // '60, 100, 3, 5' => ['60', '100', '3', '5']
            params = parts[2].split(/,\s*/)
        }

        // 占位符优先引用数据模板中的属性
        // Mock.mock({ 'name': '固定姓名', 'message': '你好，@name' })
        // message 中的 @name 会优先使用模板中的 name 即：规定姓名
        // 如果 name 在 message 前面的话，会使用 name 的值，在后面的话，则会调用 @name
        if (obj && (key in obj)) return obj[key]

        // @index @key
        // if (Constant.RE_INDEX.test(key)) return +options.name
        // if (Constant.RE_KEY.test(key)) return options.name

        // 绝对路径 or 相对路径 
        // @/number  ||  @../number   （捕获的时候会去除 @）
        if (
            key.charAt(0) === '/' ||
            pathParts.length > 1
        ) return this.getValueByKeyPath(key, options)

        // 递归引用数据模板中的属性
        if (templateContext &&
            (typeof templateContext === 'object') &&
            (key in templateContext) &&
            (placeholder !== templateContext[key]) // fix #15 避免自己依赖自己
        ) {
            // 先计算被引用的属性值
            templateContext[key] = Handler.gen(templateContext[key], key, {
                currentContext: obj,
                templateCurrentContext: templateContext
            })
            return templateContext[key]
        }

        // 如果未找到，则原样返回
        // 即不是 @占位符， 原路返回结果   @xxxx
        if (!(key in Random) && !(lkey in Random) && !(okey in Random)) return placeholder

        // 递归解析参数中的占位符
        // 'number': '@float(@natural(10, 20), 100, 3, 5)'
        // TODO: 实际的嵌套是有问题：经排查 RE_PLACEHOLDER 正则有问题： /\\*@([^@#%&()\?\s]+)(?:\((.*?)\))?/g
        // @float(20, 100, 3, 5) => ['@float(20, 100, 3, 5)', 'float', '20, 100, 3, 5']
        // 由于 后面匹配的是 ()  导致误把 @float(@natural(10, 20) 当一个整体； 后续 @natural(10, 20 当一个捕获组, 导致出问题
        // @float(@natural(10, 20), 100, 3, 5) => ['@float(@natural(10, 20)', 'float', '@natural(10, 20']
        for (var i = 0; i < params.length; i++) {
            Constant.RE_PLACEHOLDER.exec('')
            if (Constant.RE_PLACEHOLDER.test(params[i])) {
                // @natural(10, 20) 嵌套的占位符 递归解析处理
                params[i] = Handler.placeholder(params[i], obj, templateContext, options)
            }
        }

        // key: float  进入 Random 方法中执行
        var handle = Random[key] || Random[lkey] || Random[okey]
        switch (Util.type(handle)) {
            case 'array':
                // 自动从数组中取一个，例如 @areas
                return Random.pick(handle)
            case 'function':
                // 执行占位符方法（大多数情况）
                handle.options = options
                // 执行方法 返回结果
                var re = handle.apply(Random, params)
                if (re === undefined) re = '' // 因为是在字符串中，所以默认为空字符串。
                delete handle.options
                return re
        }
    },
    getValueByKeyPath: function (key, options) {
        // /foo/bar  |  ../foo/bar
        var originalKey = key
        // 把 ../foo/bar => [.., foo, bar]
        var keyPathParts = this.splitPathToArray(key)
        var absolutePathParts = []

        // 绝对路径
        if (key.charAt(0) === '/') {
            absolutePathParts = [options.context.path[0]].concat(
                this.normalizePath(keyPathParts)
            )
        } else {
            // 相对路径
            // @../foo/bar => [foo. bar]
            if (keyPathParts.length > 1) {
                absolutePathParts = options.context.path.slice(0)
                absolutePathParts.pop()
                // ['1', 'foo', 'bar']
                absolutePathParts = this.normalizePath(
                    // ['1', 'relativePath', '...', 'foo', 'bar']
                    absolutePathParts.concat(keyPathParts)
                )

            }
        }

        try {
            // keyPathParts: [.., foo, bar]  key: bar
            key = keyPathParts[keyPathParts.length - 1]
            // { foo: { bar: 'bar' } }
            var currentContext = options.context.root
            var templateCurrentContext = options.context.templateRoot
            // absolutePathParts => [1, foo. bar]
            for (var i = 1; i < absolutePathParts.length - 1; i++) {
                currentContext = currentContext[absolutePathParts[i]]
                templateCurrentContext = templateCurrentContext[absolutePathParts[i]]
            }
            // 引用的值已经计算好 - 既值已经确定，则直接返回确定的值
            // { bar: 'bar' }  key: bar  
            if (currentContext && (key in currentContext)) return currentContext[key]

            // 尚未计算，递归引用数据模板中的属性 - 值不确定，继续递归查找
            if (templateCurrentContext &&
                (typeof templateCurrentContext === 'object') &&
                (key in templateCurrentContext) &&
                (originalKey !== templateCurrentContext[key]) // fix #15 避免自己依赖自己
            ) {
                // 先计算被引用的属性值
                templateCurrentContext[key] = Handler.gen(templateCurrentContext[key], key, {
                    currentContext: currentContext,
                    templateCurrentContext: templateCurrentContext
                })
                return templateCurrentContext[key]
            }
        } catch (err) { }

        return '@' + keyPathParts.join('/')
    },
    // https://github.com/kissyteam/kissy/blob/master/src/path/src/path.js
    normalizePath: function (pathParts) {
        var newPathParts = []
        for (var i = 0; i < pathParts.length; i++) {
            switch (pathParts[i]) {
                case '..':
                    newPathParts.pop()
                    break
                case '.':
                    break
                default:
                    newPathParts.push(pathParts[i])
            }
        }
        return newPathParts
    },
    // 切割 path 成数组，过滤为空数据  - 
    // 在相对路径 和 绝对路径中处理使用(传参不会捕获 @) /number => [number]  ../number => [.., unmber]
    splitPathToArray: function (path) {
        // 以 / 去切割
        var parts = path.split(/\/+/);
        // 如果最后一个元素为空、false 等情形，则去除
        if (!parts[parts.length - 1]) parts = parts.slice(0, -1)
        // 校验第一个元素
        if (!parts[0]) parts = parts.slice(1)
        // ['float']
        return parts;
    }
})

module.exports = Handler