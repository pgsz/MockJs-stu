/* global window, document, location, Event, setTimeout */
// 实现了一个 MockXMLHttpRequest 类，用于模拟原生的 XMLHttpRequest 对象，主要目的是拦截和模拟 Ajax 请求。
/*
    ## MockXMLHttpRequest

    期望的功能：
    1. 完整地覆盖原生 XHR 的行为
    2. 完整地模拟原生 XHR 的行为
    3. 在发起请求时，自动检测是否需要拦截
    4. 如果不必拦截，则执行原生 XHR 的行为
    5. 如果需要拦截，则执行虚拟 XHR 的行为
    6. 兼容 XMLHttpRequest 和 ActiveXObject
        new window.XMLHttpRequest()
        new window.ActiveXObject("Microsoft.XMLHTTP")

    关键方法的逻辑：
    * new   此时尚无法确定是否需要拦截，所以创建原生 XHR 对象是必须的。
    * open  此时可以取到 URL，可以决定是否进行拦截。
    * send  此时已经确定了请求方式。

    规范：
    http://xhr.spec.whatwg.org/
    http://www.w3.org/TR/XMLHttpRequest2/

    参考实现：
    https://github.com/philikon/MockHttpRequest/blob/master/lib/mock.js
    https://github.com/trek/FakeXMLHttpRequest/blob/master/fake_xml_http_request.js
    https://github.com/ilinsky/xmlhttprequest/blob/master/XMLHttpRequest.js
    https://github.com/firebug/firebug-lite/blob/master/content/lite/xhr.js
    https://github.com/thx/RAP/blob/master/lab/rap.plugin.xinglie.js

    **需不需要全面重写 XMLHttpRequest？**
        http://xhr.spec.whatwg.org/#interface-xmlhttprequest
        关键属性 readyState、status、statusText、response、responseText、responseXML 是 readonly，所以，试图通过修改这些状态，来模拟响应是不可行的。
        因此，唯一的办法是模拟整个 XMLHttpRequest，就像 jQuery 对事件模型的封装。

    // Event handlers
    onloadstart         loadstart
    onprogress          progress
    onabort             abort
    onerror             error
    onload              load
    ontimeout           timeout
    onloadend           loadend
    onreadystatechange  readystatechange
 */

var Util = require('../util')

// 备份原生 XMLHttpRequest， 在不需要拦截请求时使用原生对象
window._XMLHttpRequest = window.XMLHttpRequest
window._ActiveXObject = window.ActiveXObject

/*
    PhantomJS
    TypeError: '[object EventConstructor]' is not a constructor (evaluating 'new Event("readystatechange")')

    https://github.com/bluerail/twitter-bootstrap-rails-confirm/issues/18
    https://github.com/ariya/phantomjs/issues/11289
*/
// 对自定义事件创建方式的兼容性处理，以确保在不同浏览器环境下都能正常创建自定义事件
/* <button id="myButton">触发自定义事件</button>
<script>
    // 创建自定义事件，事件类型为 'mySpecialEvent'
    const myEvent = new Event('mySpecialEvent');

    // 监听自定义事件
    document.addEventListener('mySpecialEvent', function () {
        console.log('自定义事件 mySpecialEvent 已触发');
    });

    // 获取按钮元素
    const button = document.getElementById('myButton');

    // 点击按钮时触发自定义事件
    button.addEventListener('click', function () {
      document.dispatchEvent(myEvent);
    });
</script> */
try {
    /**
     * 现代浏览器支持的创建自定义事件
     * Event 和 CustomEvent 区别：
     * Event 不支持传递自定义数据， CustomEvent 更好 支持
     * Event 兼容性相对于 CustomEvent 更好
    */
    new window.Event('custom')
} catch (exception) {
    window.Event = function (type, bubbles, cancelable, detail) {
        // tag: 自定义事件： CustomEvent 是必须，不能随意更改，是 浏览器 API 规定的字符串
        var event = document.createEvent('CustomEvent') // MUST be 'CustomEvent'
        // 初始化自定义事件
        // type：事件名称； bubbles：是否冒泡 默认 false
        // cancelable 事件是否可以被取消 默认 false   detail：传递自定义数据
        event.initCustomEvent(type, bubbles, cancelable, detail)
        return event
    }
}

// 定义 XHR 状态
var XHR_STATES = {
    // The object has been constructed.
    // XMLHttpRequest 对象已经创建，但 open() 方法还未被调用，请求尚未初始化。
    UNSENT: 0,
    // The open() method has been successfully invoked.
    // open() 方法已经被调用，请求已经初始化，但 send() 方法还未被调用，请求还未发送。
    OPENED: 1,
    // All redirects (if any) have been followed and all HTTP headers of the response have been received.
    // send() 方法已经被调用，并且已经接收到了服务器的响应头。
    HEADERS_RECEIVED: 2,
    // The response's body is being received.
    // 正在接收服务器的响应数据，此时 responseText 属性可能已经包含了部分数据。
    LOADING: 3,
    // The data transfer has been completed or something went wrong during the transfer (e.g. infinite redirects).
    // 请求已经完成，响应数据已经全部接收完毕。此时可以根据 status 属性判断请求是否成功。
    DONE: 4
}
// 定义XHR事件
/**
 * 1：readystatechange : 跟踪请求的不同状态变，分为 0、1、2、3、4
 * 2：loadstart ：当调用 XMLHttpRequest 对象的 send() 方法后，请求开始建立连接并发送数据，此时会触发 loadstart 事件
 * 3：progress ：在 loadstart 之后，可能会多次触发，直到请求完成。
 *              在数据传输过程中，只要有新的数据块到达，就会触发 progress 事件。这个事件通常用于显示进度条等场景，让用户了解数据传输的进度。
 * 4：abort ：在 progress 过程中，如果调用 XMLHttpRequest 对象的 abort() 方法中断请求，会触发该事件。
 *            当用户主动取消请求，或者代码中调用 abort() 方法时，请求会被中断，此时触发 abort 事件。
 * 5：error ： 在请求过程中出现错误（如无法连接到服务器、DNS 解析失败等）时，导致请求无法正常进行时触发。
 * 6：load ：请求正常完成，服务器返回了响应数据，此时触发 load 事件。
 * 7：timeout ：请求超过 timeout 属性设置的时间仍未完成时，会触发 timeout 事件（异步请求时才有效果）
 *              即 open(method, url, async(默认是 true))
 * 8：loadend ： 无论请求是成功完成（load）、被取消（abort）、发生错误（error）还是超时（timeout），最后都会触发 loadend 事件。
 *               表示请求的整个生命周期结束，可用于进行一些清理工作。
 *  顺序： loadstart -> progress -> (abort | error | timeout | load) -> loadend
 *        progress  会多次触发
*/
var XHR_EVENTS = 'readystatechange loadstart progress abort error load timeout loadend'.split(' ')
// 请求属性  withCredentials： 是否携带跨域凭证
var XHR_REQUEST_PROPERTIES = 'timeout withCredentials'.split(' ')
// 响应属性
var XHR_RESPONSE_PROPERTIES = 'readyState responseURL status statusText responseType response responseText responseXML'.split(' ')

// HTTP 状态码 和 描述
// https://github.com/trek/FakeXMLHttpRequest/blob/master/fake_xml_http_request.js#L32
var HTTP_STATUS_CODES = {
    100: 'Continue',
    101: 'Switching Protocols',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    300: 'Multiple Choice',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Requested Range Not Satisfiable',
    417: 'Expectation Failed',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported'
}

/*
    MockXMLHttpRequest
    MockXMLHttpRequest 充当了一个代理层，底层可能是模拟逻辑，也可能是原生逻辑，但对开发者来说，接口是统一的。
*/

function MockXMLHttpRequest() {
    // 初始化 custom 对象，用于存储自定义属性
    this.custom = {
        // 自定义事件
        events: {},
        // 请求头
        requestHeaders: {},
        // 响应头
        responseHeaders: {}
    }
}

MockXMLHttpRequest._settings = {
    timeout: '10-100',
    /*
        timeout: 50,
        timeout: '10-100',
     */
}
// 定义 setup 方法，覆盖默认的
MockXMLHttpRequest.setup = function (settings) {
    Util.extend(MockXMLHttpRequest._settings, settings)
    return MockXMLHttpRequest._settings
}

// 将 XHR_STATES 状态常量扩展到 MockXMLHttpRequest 和 其原型上
Util.extend(MockXMLHttpRequest, XHR_STATES)
Util.extend(MockXMLHttpRequest.prototype, XHR_STATES)

// 标记当前对象为 MockXMLHttpRequest
MockXMLHttpRequest.prototype.mock = true

// 是否拦截 Ajax 请求
MockXMLHttpRequest.prototype.match = false

// 初始化 Request 相关的属性和方法
Util.extend(MockXMLHttpRequest.prototype, {
    // https://xhr.spec.whatwg.org/#the-open()-method
    // Sets the request method, request URL, and synchronous flag.
    // 模拟 XMLHttpRequest 对象的 opne 方法，拦截和处理 HTTP 请求
    // 初始化请求
    open: function (method, url, async, username, password) {
        var that = this

        // 存储至 this.custom 对象中
        Util.extend(this.custom, {
            method: method,
            url: url,
            async: typeof async === 'boolean' ? async : true,
            username: username,
            password: password,
            options: {
                url: url,
                type: method
            }
        })

        /**
         * 设置 超时时间
         * 400、'400'、'200-500'
         * ~: 按位取反运算符 
         * ~timeout.indexOf('-'): 判断 timeout 中是否包含 -
         * timeout.indexOf('-') 返回 -1： -1 的 32 为二进制是 11111111 11111111 11111111 11111111（补码形式）
         * 对其进行按位取反操作后，结果是 00000000 00000000 00000000 00000000，也就是十进制的 0
         * ~ -1：0； ~ 0： -1； ~1： -2
         * 等同于：timeout.indexOf('-') !== -1
        */
        this.custom.timeout = function (timeout) {
            if (typeof timeout === 'number') return timeout
            // 不存在 -   '400'
            if (typeof timeout === 'string' && !~timeout.indexOf('-')) return parseInt(timeout, 10)
            // 存在 -   '200-500' 
            if (typeof timeout === 'string' && ~timeout.indexOf('-')) {
                var tmp = timeout.split('-')
                var min = parseInt(tmp[0], 10)
                var max = parseInt(tmp[1], 10)
                // 返回 min - max 中的一个随机数
                return Math.round(Math.random() * (max - min)) + min
            }
        }(MockXMLHttpRequest._settings.timeout)

        // 查找与请求参数匹配的数据模板
        var item = find(this.custom.options)

        // 事件处理：将原生 XHR 的响应属性 同步到 MockXMLHttpRequest ，并让 MockXMLHttpRequest 触发相应事件
        function handle(event) {
            // 同步属性 NativeXMLHttpRequest => MockXMLHttpRequest
            for (var i = 0; i < XHR_RESPONSE_PROPERTIES.length; i++) {
                try {
                    that[XHR_RESPONSE_PROPERTIES[i]] = xhr[XHR_RESPONSE_PROPERTIES[i]]
                } catch (e) { }
            }
            // 触发 MockXMLHttpRequest 上的同名事件，确保 MockXHR 的行为与原生 XHR 一致
            that.dispatchEvent(new Event(event.type /*, false, false, that*/))
        }

        // 如果未找到匹配的数据模板，则采用原生 XHR 发送请求。
        if (!item) {
            // 创建原生 XHR 对象，调用原生 open()，监听所有原生事件
            var xhr = createNativeXMLHttpRequest()
            this.custom.xhr = xhr

            // 初始化所有事件，用于监听原生 XHR 对象的事件
            for (var i = 0; i < XHR_EVENTS.length; i++) {
                /**
                 * open() 之前，为 NativeXMLHttpRequest 预先注册事件监听器，监听 XHR_EVENTS 中定义的所有事件
                 * 必须要，否则：走原生 XHR 时，无法获取对应数据和事件
                */
                xhr.addEventListener(XHR_EVENTS[i], handle)
            }

            // xhr.open()
            if (username) xhr.open(method, url, async, username, password)
            else xhr.open(method, url, async)

            // 同步属性 MockXMLHttpRequest => NativeXMLHttpRequest
            /**
             * open() 之后， send() 之前
             * 将 MockXMLHttpRequest 的请求属性同步到 NativeXMLHttpRequest 中
             * 确保 XHR 在发送请求时，使用的是 MockXMLHttpRequest 中设置的请求配置
            */
            for (var j = 0; j < XHR_REQUEST_PROPERTIES.length; j++) {
                try {
                    xhr[XHR_REQUEST_PROPERTIES[j]] = that[XHR_REQUEST_PROPERTIES[j]]
                } catch (e) { }
            }

            return
        }

        // 找到了匹配的数据模板，开始拦截 XHR 请求
        this.match = true
        this.custom.template = item
        this.readyState = MockXMLHttpRequest.OPENED
        this.dispatchEvent(new Event('readystatechange' /*, false, false, this*/))
    },
    // https://xhr.spec.whatwg.org/#the-setrequestheader()-method
    // Combines a header in author request headers.
    setRequestHeader: function (name, value) {
        // 原生 XHR
        if (!this.match) {
            // 原生 XHR setRequestHeader 方法
            this.custom.xhr.setRequestHeader(name, value)
            return
        }

        // 拦截 XHR
        var requestHeaders = this.custom.requestHeaders
        if (requestHeaders[name]) requestHeaders[name] += ',' + value
        else requestHeaders[name] = value
    },
    timeout: 0,
    withCredentials: false,
    upload: {},
    // https://xhr.spec.whatwg.org/#the-send()-method
    // Initiates the request.
    send: function send(data) {
        var that = this
        this.custom.options.body = data

        // 原生 XHR
        if (!this.match) {
            this.custom.xhr.send(data)
            return
        }

        // 拦截 XHR
        // X-Requested-With header
        this.setRequestHeader('X-Requested-With', 'MockXMLHttpRequest')

        // loadstart The fetch initiates.
        this.dispatchEvent(new Event('loadstart' /*, false, false, this*/))

        if (this.custom.async) setTimeout(done, this.custom.timeout) // 异步
        else done() // 同步

        function done() {
            // send()  方法已调用
            that.readyState = MockXMLHttpRequest.HEADERS_RECEIVED
            that.dispatchEvent(new Event('readystatechange' /*, false, false, that*/))
            that.readyState = MockXMLHttpRequest.LOADING
            that.dispatchEvent(new Event('readystatechange' /*, false, false, that*/))

            that.status = 200
            that.statusText = HTTP_STATUS_CODES[200]

            // fix #92 #93 by @qddegtya
            that.response = that.responseText = JSON.stringify(
                // 数据模板 ＝> 响应数据
                convert(that.custom.template, that.custom.options),
                // replacer: function | []  对数据进行替换或保留那些数据
                null, 
                // space: number | string  json 字符串缩进格式
                4
            )

            that.readyState = MockXMLHttpRequest.DONE
            that.dispatchEvent(new Event('readystatechange' /*, false, false, that*/))
            that.dispatchEvent(new Event('load' /*, false, false, that*/));
            that.dispatchEvent(new Event('loadend' /*, false, false, that*/));
        }
    },
    // https://xhr.spec.whatwg.org/#the-abort()-method
    // Cancels any network activity.
    abort: function abort() {
        // 原生 XHR
        if (!this.match) {
            this.custom.xhr.abort()
            return
        }

        // 拦截 XHR
        this.readyState = MockXMLHttpRequest.UNSENT
        this.dispatchEvent(new Event('abort', false, false, this))
        this.dispatchEvent(new Event('error', false, false, this))
    }
})

// 初始化 Response 相关的属性和方法
Util.extend(MockXMLHttpRequest.prototype, {
    responseURL: '',
    status: MockXMLHttpRequest.UNSENT,
    statusText: '',
    // https://xhr.spec.whatwg.org/#the-getresponseheader()-method
    getResponseHeader: function (name) {
        // 原生 XHR
        if (!this.match) {
            return this.custom.xhr.getResponseHeader(name)
        }

        // 拦截 XHR
        return this.custom.responseHeaders[name.toLowerCase()]
    },
    // https://xhr.spec.whatwg.org/#the-getallresponseheaders()-method
    // http://www.utf8-chartable.de/
    getAllResponseHeaders: function () {
        // 原生 XHR
        if (!this.match) {
            return this.custom.xhr.getAllResponseHeaders()
        }

        // 拦截 XHR
        var responseHeaders = this.custom.responseHeaders
        var headers = ''
        for (var h in responseHeaders) {
            if (!responseHeaders.hasOwnProperty(h)) continue
            headers += h + ': ' + responseHeaders[h] + '\r\n'
        }
        return headers
    },
    overrideMimeType: function ( /*mime*/) { },
    responseType: '', // '', 'text', 'arraybuffer', 'blob', 'document', 'json'
    response: null,
    responseText: '',
    responseXML: null
})

// EventTarget
Util.extend(MockXMLHttpRequest.prototype, {
    addEventListener: function addEventListener(type, handle) {
        var events = this.custom.events
        if (!events[type]) events[type] = []
        events[type].push(handle)
    },
    removeEventListener: function removeEventListener(type, handle) {
        var handles = this.custom.events[type] || []
        for (var i = 0; i < handles.length; i++) {
            if (handles[i] === handle) {
                handles.splice(i--, 1)
            }
        }
    },
    dispatchEvent: function dispatchEvent(event) {
        var handles = this.custom.events[event.type] || []
        for (var i = 0; i < handles.length; i++) {
            handles[i].call(this, event)
        }

        var ontype = 'on' + event.type
        if (this[ontype]) this[ontype](event)
    }
})

// Inspired by jQuery
function createNativeXMLHttpRequest() {
    // 判断当前页面是否运行在本地协议
    var isLocal = function () {
        /**
         * ^ :匹配字符串的开头
         * (?:) :非捕获组，将多个选项组合在一起，但不捕获匹配的内容
         * about|app|app-storage|.+-extension|file|res|widget : 多个选项的列表， | 分割，匹配其中任意一个
         * .+-extension : 匹配以 -extension 结尾的协议
         * :$   : 匹配冒号 $ 表示字符串的结尾   冒号位于字符串的结尾
         * 以about:、app:、app-storage:、file:、res:、widget:等本地协议开头
         * 或者以-extension:结尾的协议（如chrome-extension:）
         * 判断当前页面是否运行在本地环境中，而不是通过HTTP/HTTPS等网络协议加载
        */
        var rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/
        /**
         * 1：([\w.+-]+:)  
         * \w :匹配任何字母、数字或下划线  .+- 匹配 点好、加号或减号
         * + :出现一个或多次
         * : :表示冒号
         * 捕获用于匹配 URL 的协议部分： http: https: ftp:
         * 2：\/\/([^\/?#:]*)
         * \/\/ : 连续两个斜杠 //
         * ([^\/?#:]*) : [^] 否定取反字符，匹配除 / ? # : 之外的任意字符   * 前面的否定字符可以出现零次或多次
         * 捕获用于匹配URL 的足迹部分： example.com
         * 3：(?::(\d+)|)
         * ?: 非捕获组  : 匹配冒号 (\d+) 匹配任意数字可以一次或多次
         * 捕获匹配 URL 的端口部分： 8080
         * 4：| 或运算符，前面是可选的
         * 即第一个 | 匹配 :(\d+) 是可选的
         * 第二个 | 可以匹配空字符串，这部分内容是可选的
        */
        var rurl = /^([\w.+-]+:)(?:\/\/([^\/?#:]*)(?::(\d+)|)|)/
        var ajaxLocation = location.href
        var ajaxLocParts = rurl.exec(ajaxLocation.toLowerCase()) || []
        return rlocalProtocol.test(ajaxLocParts[1])
    }()

    // 判断是否存在 ActiveXObject （判断是否是 IE 浏览器）
    return window.ActiveXObject ?
        // IE 浏览器且不是本地协议 创建 XMLHttpRequest 失败则创建 ActiveXObject
        // 不是 IE 浏览器，直接创建 XMLHttpRequest
        (!isLocal && createStandardXHR() || createActiveXHR()) : createStandardXHR()

        // 原生 XMLHttpRequest 
    function createStandardXHR() {
        try {
            return new window._XMLHttpRequest();
        } catch (e) { }
    }

    // 原生 ActiveXObject （IE浏览器）
    function createActiveXHR() {
        try {
            return new window._ActiveXObject('Microsoft.XMLHTTP');
        } catch (e) { }
    }
}

// 查找与请求参数匹配的数据模板：URL，Type
// { url: 'xxxxx', type: 'get|pos|...' }
function find(options) {
    // MockXMLHttpRequest.Mock._mocked 见 mock.js
    for (var sUrlType in MockXMLHttpRequest.Mock._mocked) {
        var item = MockXMLHttpRequest.Mock._mocked[sUrlType]
        if (
            // url 匹配
            (!item.rurl || match(item.rurl, options.url)) &&
            // 请求类型匹配
            (!item.rtype || match(item.rtype, options.type.toLowerCase()))
        ) {
            // console.log('[mock]', options.url, '>', item.rurl)
            return item
        }
    }

    // 判断 数据类型，并返回是否 相等或匹配
    function match(expected, actual) {
        if (Util.type(expected) === 'string') {
            return expected === actual
        }
        if (Util.type(expected) === 'regexp') {
            return expected.test(actual)
        }
    }
}

// 数据模板 ＝> 响应数据
function convert(item, options) {
    return Util.isFunction(item.template) ?
        item.template(options) : MockXMLHttpRequest.Mock.mock(item.template)
}

module.exports = MockXMLHttpRequest