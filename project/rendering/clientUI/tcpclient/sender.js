const LOCAL_HOST = "127.0.0.1";
const net = require('net');
let isConnection = false;
let client = null;
let versionProtocolFlag = (1 << 14);
let multiplePackagesFlag = (1 << 13);
let msgLengthStance = 1023;
let msgAttrhigh8Stance = 64512;
const shell = require('electron').shell;
let tcpServerInfoList = new Array();
$(document).ready(function () {
    $('[data-toggle="tooltip"]').tooltip();


    function chanageConnectionBtnStatus(){
        if (isConnection){
            $("#buildConnection").css("background-color", "#ff122b");
            $("#buildConnection").css("border-color", "#ff122b");
        }else {
            $("#buildConnection").css("background-color", "#f0ad4e");
            $("#buildConnection").css("border-color", "#eea236");
        }
    }

    $("#clean").click(function () {
        $("#hextbody").html("");
        $("#msgBox").css("background","url('../tcpclient/msg3.png') no-repeat");
        $("#msgBox").css("background-size","contain");
    });

    $("#openDebug").click(function () {
        ipc.send('openDevTools');
    });


    $("#buildConnection").click(function () {
        const topIp = $("#topIp").val().trim();
        const tcpPort = $("#tcpPort").val().trim();
        checkConnectionInfo(topIp, tcpPort);

    });

    /**
     * 发送报文
     */
    $("#sendInfo").click(function () {
        consoleLog("==============================================================================>>");
        if (isConnection){
            let packageDataStr = $("#packageDataStr").val().trim();
            let ischeck = $('#checkCode').prop('checked');
            packageDataStr = delBlankSpace(packageDataStr);
            let array = packageDataStrTransforBytes(packageDataStr);
            let reductionArray = new Array();
            if (checkPackageData(packageDataStr)){
                //检查部标808协议相关规则
                if (ischeck){
                    if(!check808(array)){
                        return;
                    }
                    //获取还原后转义的报文
                    reductionArray = reductionAndEscape(array);
                    get808VersionProtocol(reductionArray);
                    //拿到还原后的报文计算校验码
                    calculationCheckCode(reductionArray);
                    array = getSenseData(reductionArray);
                }
                const buf = new Buffer(array);
                const buf1 = Buffer.alloc(array.length, buf);
                let result = client.write(buf1);
                if (result){
                    sendDataAddHtml(array);
                }else {
                    console.log("报文发送失败");
                }
            }else {
                console.log("报文格式异常");
            }
        }else {
            console.log("连接未建立");
        }
    });

    /**
     * 转义报文
     * @param reductionArray
     */
    function getSenseData(reductionArray) {
        let count = 0;
        for (let i = 1; i < reductionArray.length - 1; i++) {
            if (reductionArray[i] == 0x7e || reductionArray[i] == 0x7d) {
                count++;
            }
        }
        if (count == 0) {
            return reductionArray;
        }
        let senseData = new Array(reductionArray.length + count);
        count = 0;
        senseData[count++] = reductionArray[0];
        for (let i = 1; i < reductionArray.length - 1; i++) {
            if (reductionArray[i] == 0x7e) {
                senseData[count++] = 0x7d;
                senseData[count++] = 0x02;
            } else if (reductionArray[i] == 0x7d) {
                senseData[count++] = 0x7d;
                senseData[count++] = 0x01;
            } else {
                senseData[count++] = reductionArray[i];
            }
        }
        senseData[count++] = reductionArray[reductionArray.length - 1];
        return senseData;
    }

    /**
     * 或去协议版本
     */
    function get808VersionProtocol(array) {
        let index = 1;
        let version = 0;
        let isMultipleStr = "不分包";
        let isMultiple = false;
        let bodyLength = 0;
        let cmdHex = ((array[index++] << 8) + array[index++]).toString(16);
        if (cmdHex.length != 4){
            cmdHex = "0000" + cmdHex;
            cmdHex = cmdHex.substring(cmdHex.length - 4,cmdHex.length);
        }
        let bodyAttribute = (array[index++] << 8) + array[index++];
        let bodyAttributeHex = bodyAttribute.toString(16);
        if (bodyAttributeHex.length != 4){
            bodyAttributeHex = "0000" + bodyAttributeHex;
            bodyAttributeHex = bodyAttributeHex.substring(bodyAttributeHex.length - 4,bodyAttributeHex.length);
        }
        if ((bodyAttribute & versionProtocolFlag) == versionProtocolFlag){
            version = 2019;
        }else {
            version = 2013;
        }
        let result = bodyAttribute & multiplePackagesFlag;
        if (result == multiplePackagesFlag){
            isMultipleStr = "分包";
            isMultiple = true;
        }
        let msgLength = (bodyAttribute & msgLengthStance);
        if (version == 2019){
            if (isMultiple){
                bodyLength = array.length - 20 - 4;
            }else {
                bodyLength = array.length - 20;
            }
        }else{
            if (isMultiple){
                bodyLength = array.length - 15 - 4;
            }else {
                bodyLength = array.length - 15;
            }
        }
        consoleLog("上行报文消息ID:0x" + cmdHex +"，消息体属性:0x" + bodyAttributeHex + "，部标808协议版本:"+ version +"，消息体长度：" + msgLength +",属于：" + isMultipleStr);
        if (bodyLength != msgLength){
            let temp = bodyAttribute & msgAttrhigh8Stance;
            let newBodyAttribute = temp | bodyLength;
            array[3] = (newBodyAttribute >> 8);
            array[4] = (newBodyAttribute & 255);
            consoleLog("消息体长度不正确,原始报文消息体长度为:" + msgLength + ",工具计算出的消息体长度为：" + bodyLength)
        }
    }

    /**
     * 检查是否满足808协议规则 如7E开头和结尾
     * @param array
     */
    function check808(array) {
        let startFlag = array[0];
        let endFlag = array[array.length - 1 ];
        if (startFlag != 0x7e){
            consoleLog("报文不是一7E标识开始");
            return false;
        }else if (endFlag != 0x7e){
            consoleLog("报文不是一7E标识结束");
            return false;
        }
        return true;

    }
    /**
     * 还原转义，把发送前的报文进反转义得到真实报文
     * 为什么要反转义，是为了计算校验位做准备。
     * @param array
     */
    function reductionAndEscape(array) {
        let tempBuffer = new Array();
        for (let i = 0;i < array.length; i++ ){
            let tempByte = array[i];
            if (tempByte == 0x7d){
                if(array[i + 1] == 0x01){
                    tempBuffer.push(0x7d);
                    i++;
                    continue;
                }
                if(array[i + 1] == 0x02){
                    tempBuffer.push(0x7e);
                    i++;
                    continue;
                }
            }
            tempBuffer.push(tempByte);
        }
        return tempBuffer;
    }
    /**
     * 校验位计算
     * @param tempBuffer 被反转义后的 报文
     */
    function calculationCheckCode(reductionArray) {
        let fullData = reductionArray.slice(1,reductionArray.length - 1);
        let beginIndex = 0;
        let endIndex = fullData.length - 1;
        let newFlag = fullData[beginIndex];
        for (let j = beginIndex + 1, c = endIndex; j < c; j++) {
            newFlag ^= fullData[j];
        }
        let oldFlag = fullData[endIndex];
        if (newFlag != oldFlag) {
            reductionArray[reductionArray.length - 2 ] = newFlag;
            consoleLog("您报文的校验码错误,以前是:"+ oldFlag.toString(16).toLocaleUpperCase()+ " ,改为了:" + newFlag.toString(16).toLocaleUpperCase());
            return newFlag;
        }else {
            return oldFlag;
        }
    }

    /**
     * 检查连接信息
     *
     * @param topIp
     * @param tcpPort
     * @returns {boolean}
     */
    function checkConnectionInfo(topIp, tcpPort) {
        if (!isConnection){
            if (topIp == "" || topIp == null || topIp == undefined) {
                topIp = LOCAL_HOST;
            }
            if (tcpPort == "" || tcpPort == null || tcpPort == undefined) {
                consoleLog("端口为空");
                return false;
            }
            console.log(topIp + ":" + tcpPort);
            client = net.connect({
                port: tcpPort,
                host: topIp,
            }, function() {
                consoleLog("connected to server  " + topIp +":"+tcpPort);
                isConnection = true;
                chanageConnectionBtnStatus();
            });
            client.on('data', function(data){
                acceptData(data);
            });
            client.on('end',function(){
                consoleLog('会话结束');
                isConnection = false;
                chanageConnectionBtnStatus();
            });
            client.on('error', function () {
                consoleLog('出现错误');
                isConnection = false;
            });
            client.on('close',function () {
                consoleLog('连接断开');
                isConnection = false;
                chanageConnectionBtnStatus();
            });

        }else {
            client.end();
            isConnection = false;
        }
    }

    function consoleLog(data) {
        console.log(data);
        let date = new Date(+new Date() + 8 * 3600 * 1000).toISOString().replace(/T/g, ' ').replace(/\.[\d]{3}Z/, '');
        console.log(date);
        let text = $("#syslogSpan").text();
        if (text == ''){
            let logHtmel = "<span style=\"color: #6edeef\">"+date +" </span><span class='glyphicon glyphicon-console'></span> " + data;
            $("#syslogSpan").append(logHtmel);
        }else {
            let logHtmel = "\n" + "<span style=\"color: #6edeef\">"+date +" </span><span class='glyphicon glyphicon-console'></span> " + data;
            $("#syslogSpan").append(logHtmel);
        }
    }

    function sendDataAddHtml(data) {
        let sendData = bytesTransforString(data);
        $("#msgBox").css("background","");
        let sendDataHtml = "<tr id='hexCol' style='border-bottom:1px solid #ddd;'>\n" +
            "<th style=\"display:table-cell; vertical-align:middle;text-align: center;width: 30px;border-right:1px solid #ddd;\" scope=\"row\">\n" +
            "<span class=\"glyphicon glyphicon-export\" aria-hidden=\"true\"></span>\n" +
            "</th>\n" +
            "<td>"+sendData+"</td>\n" +
            "</tr>";
        $("#hextbody").append(sendDataHtml);
        var msgBox = document.getElementById('msgBox');
        msgBox.scrollTop = msgBox.scrollHeight;
        consoleLog('发送数据:' + sendData);
    }
    /**
     * 接受数据
     * @param data
     */
    function acceptData(data) {
        $("#msgBox").css("background","");
        let acceptData = bytesTransforString(data);
        let acceptDataHtml = "<tr id='hexCol' style='border-bottom:1px solid #ddd;'>\n" +
            "<th  style=\"display:table-cell; vertical-align:middle;text-align: center;width: 30px;border-right:1px solid #ddd;\" scope=\"row\">\n" +
            "<span class=\"glyphicon glyphicon-import\" aria-hidden=\"true\"></span>\n" +
            "</th>\n" +
            "<td>"+acceptData+"</td>\n" +
            "</tr>";
        $("#hextbody").append(acceptDataHtml);
        consoleLog('接受数据:' + acceptData);
        var msgBox = document.getElementById('msgBox');
        msgBox.scrollTop = msgBox.scrollHeight;
    }



    function appendEnvironmentTbodyHtml() {
        $("#environmentTbody").html("");
        $("#tcpServerInfoListUl").html("");
        for (let i = 0; i < tcpServerInfoList.length; i++){
            let ip = tcpServerInfoList[i].ip;
            let port = tcpServerInfoList[i].port;
            let describe = tcpServerInfoList[i].describe;
            let environmentTbodyHtml = "<tr class='tcpServerInfoItem'>\n" +
                "                            <td class='ip'><div class=\"contenteditable\">"+ip+"</div></td>\n" +
                "                            <td class='port'><div class=\"contenteditable\">"+port+"</div></td>\n" +
                "                            <td class='describe'><div class=\"contenteditable\">"+describe+"</div></td>\n" +
                "                            <td>\n" +
                "                                <button type=\"button\" class=\"btn btn-warning btn-xs delTcpServerInfoItem\">DELETE</button>\n" +
                "                            </td>\n" +
                "                        </tr>";
            $("#environmentTbody").append(environmentTbodyHtml);
            $("#tcpServerInfoListUl").append("<li class='tcpServerName'><a href=\"#\"  ip='"+ip+"' port = '"+port+"'>"+describe+"</a></li>");
        }
        $(".contenteditable").attr("contenteditable", true);

    }


    function initTcpServerInfo(){
        tcpServerInfoList = [{"ip": "127.0.0.1", "port": "32937", "describe": "本地测试   XXX测试环境"}, {
            "ip": "127.0.0.1",
            "port": "32937",
            "describe": "本地测试   XXX"
        }, {"ip": "127.0.0.1", "port": "22046", "describe": "本地测试   XXX1环境"}, {
            "ip": "127.0.0.1",
            "port": "22046",
            "describe": "本地测试   XXXX"
        }];

        let initTcpServerInfoPath = exePath +'/initTcpServerInfo.json';
        //判断接收机地址文件是否存在，如果不存进创建
        fs.exists(initTcpServerInfoPath, function(exists) {
            if (!exists){
                appendEnvironmentTbodyHtml();
                fs.writeFile(initTcpServerInfoPath,JSON.stringify(tcpServerInfoList), function (err) {
                    if(err){
                        consoleLog("生成接收机列表出现异常:" + err);
                    }else{
                        consoleLog("生成接收机列表成功");
                        consoleLog(initTcpServerInfoPath);
                    }
                });
            }else {
                fs.readFile(initTcpServerInfoPath, 'utf-8', function(err, data) {
                    consoleLog("读取本地文件地址");
                    consoleLog(initTcpServerInfoPath);
                    consoleLog("读取本地文件信息："+ data);
                    tcpServerInfoList = JSON.parse(data);
                    appendEnvironmentTbodyHtml();
                });
            }
        });

    };
    initTcpServerInfo();

    $("#environmentButton").click(function () {
        $("#environment").modal();
        appendEnvironmentTbodyHtml();
    });


    $("#fileData").click(function () {
        $("#fileDataMolde").modal();
    });

    $("#saveEnvironment").click(function () {
        tcpServerInfoList = new Array();
        $('.tcpServerInfoItem').each(function (index, item) {
            let ip = $(item).find(".ip").find("div").text();
            let port = $(item).find(".port").find("div").text();
            let describe = $(item).find(".describe").find("div").text();
            let tcpServerInfoNode = {
                "ip": ip,
                "port": port,
                "describe": describe
            };
            tcpServerInfoList.push(tcpServerInfoNode);
        });
        appendEnvironmentTbodyHtml();
        let initTcpServerInfoPath = exePath +'/initTcpServerInfo.json';
        fs.writeFile(initTcpServerInfoPath,JSON.stringify(tcpServerInfoList), function (err) {
            if(err){
                consoleLog("存储接收机列表出现异常:" + err);
            }else{
                consoleLog("存储接收机列表成功");
                consoleLog(initTcpServerInfoPath);
            }
        });
        $("#environment").modal('hide');
    });
    
    /**
     * 添加
     */
    $("#addEnvironmentInfoBtn").click(function () {
        let environmentTbodyHtml = "<tr class='tcpServerInfoItem'>\n" +
            "                            <td class='ip'><div class=\"contenteditable\">--</div></td>\n" +
            "                            <td class='port'><div class=\"contenteditable\">--</div></td>\n" +
            "                            <td class='describe'><div class=\"contenteditable\">--</div></td>\n" +
            "                            <td>\n" +
            "                                <button type=\"button\" class=\"btn btn-warning btn-xs delTcpServerInfoItem\">DELETE</button>\n" +
            "                            </td>\n" +
            "                        </tr>";
        $("#environmentTbody").append(environmentTbodyHtml);
        $(".contenteditable").attr("contenteditable", true);
    });
    
    
    $("#environmentTbody").on("click",".delTcpServerInfoItem",function () {
        $(this).parent("td").parent(".tcpServerInfoItem").remove();
    });


    $("#tcpServerInfoListUl").on('click',".tcpServerName",function () {
        let ip = $(this).find("a").attr("ip");
        let port = $(this).find("a").attr("port");
        $("#topIp").val(ip);
        $("#tcpPort").val(port);
    });



    $("#fileDataMoldeInfoBtn").click(function(){
        var path = $("#filePath").val();
        fs.exists(path, function(exists) {
            if (!exists){
                $("#flieDataTips").val("不存在文件");
            }else {
                $("#flieDataTips").val("");
                fs.readFile(path, 'utf-8', function(err, data) {
                    console.log(data)
                });
            }
        });
    });
});







/**
 * 删除报文字符串里的空格和换行符
 *
 * @param packageDataStr
 * @returns {string}
 */
function delBlankSpace(packageDataStr) {
    packageDataStr = packageDataStr.replace(/\s*/g,"");
    packageDataStr = packageDataStr.replace(/[\r\n]/g,"");
    return packageDataStr;
}


/**
 * 检查报文
 * @param packageDataStr
 * @returns {boolean}
 */
function checkPackageData(packageDataStr) {
    if (packageDataStr == "" || packageDataStr == null || packageDataStr == undefined) {
        console.log("报文为空");
        return false;
    }
    let len = packageDataStr.length;
    if ((len % 2) != 0){
        console.log("16进制报文字符串为基数");
        return false;
    }
    return true;
}

/**
 *
 * @param packageDataStr
 * @returns {any[]}
 */
function packageDataStrTransforBytes(packageDataStr) {
    let len = packageDataStr.length;
    let byteStr = "";
    let array = new Array();
    for (var i = 0; i < len; i++){
        byteStr = byteStr + packageDataStr.charAt(i);
        if (i % 2 == 1){
            array.push(Number("0x" +byteStr));
            byteStr = "";
        }
    }
    return array;
}

/**
 * byte数组转大写16进制字符串
 *
 * @param byteArray
 * @returns {string}
 */
function bytesTransforString(byteArray) {
    let packageDataStr = "";
    for (var i = 0;i < byteArray.length; i++){
        let hexString = byteArray[i].toString(16);
        if (hexString.length == 1){
            hexString = "0" + hexString;
        }
        packageDataStr = packageDataStr + hexString;
        packageDataStr = packageDataStr +" ";
    }
    return packageDataStr.toUpperCase();
}







