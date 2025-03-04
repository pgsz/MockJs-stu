/*
    ## Constant

    常量集合。
 */
/*
    RE_KEY
        'name|min-max': value
        'name|count': value
        'name|min-max.dmin-dmax': value
        'name|min-max.dcount': value
        'name|count.dmin-dmax': value
        'name|count.dcount': value
        'name|+step': value

        1 name, 2 step, 3 range [ min, max ], 4 drange [ dmin, dmax ]

    RE_PLACEHOLDER
        placeholder(*)

    [正则查看工具](http://www.regexper.com/)

    #26 生成规则 支持 负数，例如 number|-100-100
*/
module.exports = {
    GUID: 1,
    /**
     * 'number|1-10.1-2'
     * ['number|1-10.1-2', 'number', undefined, '1-10', '1-2', index: 0, input: 'number|1-10.1-2', groups: undefined]
     * 注意： 匹配字符： 没有 xxx| 时会失败，返回 null； 即 xxx、|xxx 都会失败
     * 1: (.+) 匹配任意字符（至少一个），并捕获第一个分组
     *    () 捕获符号
     *    . 元字符，匹配除换行符以外的任意单个字符
     *    + 量词，表示前面的元素可以出现一次或多次
     *    即匹配 name
     * 2：\| 匹配一个竖线符号 (|)
     * 3：?: 非捕获组
     * 4: \+(\d+) 匹配一个加号后跟一个或多个数字，并捕获数字部分
     *    即匹配 step   +123 => 匹配，捕获 123
     * 5：| 分支选择 或运算符
     * 6：([\+\-]?\d+-?[\+\-]?\d*)?
     *    [\+\-]? 可选的加号或减号字符
     *    \d+ 匹配一个或多个数字
     *    -? 可选的连字符 -
     *    即匹配 rang  min - max 并进行捕获
     * 7：(?:\.(\d+-?\d*))?)
     *    \. 匹配一个小数点
     *    (\d+-?\d*) 匹配一个或多个数字，可能包含 - 连字符， 并将其捕获到分组中
     *    即匹配 drange  dmin - dmax 并进行捕获 
     */
    RE_KEY: /(.+)\|(?:\+(\d+)|([\+\-]?\d+-?[\+\-]?\d*)?(?:\.(\d+-?\d*))?)/,
    RE_RANGE: /([\+\-]?\d+)-?([\+\-]?\d+)?/,
    /**
     * '@float(60, 100, 3, 5)'
     * ['@float(60, 100, 3, 5)', 'float', '60, 100, 3, 5', index: 0, input: '@float(60, 100, 3, 5)', groups: undefined]
     * 1: \\*@ 
     *    第一个 \ 是转义符
     *    匹配零个或多个 \
     *    匹配 @
     * 2：([^@#%&()\?\s]+)
     *    匹配除 @#%&()? 和 空白字符串之外的任何字符串，并进行捕获
     *    ^ 取反   
     *    \s 匹配任意一个空白字符： 空格、 制表符(\t)、换行符(\t)、换行符(\n)、回车符(\r)、垂直制表符(\v)、换页符(\f)
     *    \S 是 \s 的反向匹配，匹配一个或多个非空白字符
     * 3：(?:\((.*?)\))?
     *    匹配可能存在的用括号包裹的内容，并将括号内的内容捕获到一个捕获组中
    */
    RE_PLACEHOLDER: /\\*@([^@#%&()\?\s]+)(?:\((.*?)\))?/g
    // /\\*@([^@#%&()\?\s\/\.]+)(?:\((.*?)\))?/g
    // RE_INDEX: /^index$/,
    // RE_KEY: /^key$/
}
/**
 * 一：正则贪婪与非贪婪区别：
 * 贪婪模式：
 *  会尽可能多的匹配字符，使用量词： *、 + 、{n, m}
 *  a.*b 在 aabab 中会匹配整个字符串
 *  适合匹配大块内容
 * 非贪婪模式
 *  会尽可能少的匹配字符，量词后面加 ? ： *? 、 +? 、 ?? 、 {n, m}?
 *  a.*b 在 aabab 中会匹配 aab 和 ab 两个结果
 *  适合精确匹配最小单元
 * 
 * 二：捕获与非捕获
 * 捕获组： () 对指定模式进行匹配，并将匹配内容保存
 * 非捕获组： (?:) 不会保存匹配到的内容
 * 
 * 三：量词区别
 * * 表示前面元素可以出现零次或多次
 * ? 
 *  普通量词：前面元素可以出现零次或一次，该元素是可选的
 *  跟在其他量词后面，将贪婪匹配变成非贪婪匹配;
 * + 表示前面元素可以出现一次或多次，即该元素至少要出现一次； /a+/
 * {n} 表示前面的元素正好出现 n 次；/a{3}/：正好匹配三个 a
 * {n,} 表示前面元素至少出现 n 次； /a{3,}/：至少匹配 三个或更多 a
 * {n,m} 表示前面的元素出现的次数在 n 到 m 间（包含 n 和 m ）
 * 
 * 四：^ 作用：
 * 1： 在正则表达式开头表示字符串起始位置:  /^hellow/ 匹配以 hello 开头
 * 2： 在方括号 [] 内开头位置表示否定字符串，注意：在 [] 内部且是第一个字符串才表示取反；
 *     该字符类会匹配 除了 方括号内指定字符串之外的任意单个字符串
 *    /[^0-9]/: 匹配字符串中除了数字以外的字符串  '12345': false(只有数字)  '123xy': true  'xynm': true
 * 3： 在多行模式下匹配行起始位置； /^hello/m   'say hello\nhello word' 匹配第二行开头的 'hello'
 * 
 * 五：正则 match 与 exec 的区别
 * 1：所属对象： string.match(reg)   reg.exec(string)
 * 2：返回值： 
 *    match：正则表达式没有 g 标志，返回数组，包含匹配结果和捕获组信息
 *           有 g 标志，返回数组，包含所有匹配结果，不包含捕获组信息
 *    exec： 无论是否有 g 标志，都返回数组，包含匹配结果和捕获组信息
 * 3：全局匹配：
 *    str = "123-abc 456-def"   regex = /(\d+)-(\w+)/g
 *    match：一次性返回所有结果，性能相对较高
 *          ['123-abc', '456-def']
 *    exec：每次调用返回一个结果，性能相对稍低
 *          regex.exec(str): ['123-abc', '123', 'abc']
 *          regex.exec(str): ['456-def', '456', 'def']
 * 
 * 六：\s 与 \S 的区别
 * \s 匹配任意一个空白字符： 空格、 制表符(\t)、换行符(\t)、换行符(\n)、回车符(\r)、垂直制表符(\v)、换页符(\f)
 *  \S 是 \s 的反向匹配，匹配一个或多个非空白字符
 * 
 * 七： \w 与 \W 的区别
 * \w 匹配单词字符，包含：任何字母(a-z,A-Z)、数字(0-9)或下划线(_)  等价于 [a-zA-Z0-9_]
 * \W 是 \w 的反向匹配，匹配非单词字符；包含：标点符号（！、@、#等）、空格、特殊字符（-、+、*等）
*/

