const { remote } = require('electron');
const path = require('path');
/*const exePath = path.dirname(remote.app.getPath('exe'));*/
const os = require('os');
const exePath = os.homedir();
const fs = require("fs");
const ipc = require('electron').ipcRenderer;

$(document).ready(function () {
    $("#tapUl").on("click",".talLi", function () {
        $(".talLiA").removeClass("active");
        $(this).find("a").addClass("active");
        $(".contentBox").css("display","none");
        var containerId = $(this).find(".talLiA").attr("index");
        $("#"+containerId).css("display","block");
        if (containerId == "senderContainer"){
            $("#allbody").css("background-color","#FFFFFF");
        }else if (containerId == "sysLogContainer"){
            $("#allbody").css("background-color","#000000");
        }else if (containerId == "otherContainer"){
            $("#allbody").css("background-color","#16a085");
        }else {
            $("#allbody").css("background-color","#FFFFFF");
        }
    });


    $(".webLink").click(function (event) {
        event.preventDefault();
        shell.openExternal($(this).attr("url"));
    });







});