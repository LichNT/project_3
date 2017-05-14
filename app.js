
var createEditor = function() {
    var lsKey = "elevatorCrushCode_v5";

    var cm = CodeMirror.fromTextArea(document.getElementById("code"), {//  tao code mau cho  thang may.
        lineNumbers: true,
        indentUnit: 4,
        indentWithTabs: false,
        theme: "solarized light",
        mode: "javascript",
        autoCloseBrackets: true,
        extraKeys: {
            // the following Tab key mapping is from http://codemirror.net/doc/manual.html#keymaps
            Tab: function(cm) {
                var spaces = new Array(cm.getOption("indentUnit") + 1).join(" ");
                cm.replaceSelection(spaces);
            }
        }
    });
    console.log("code cua ham phu ",cm);
    // reindent on paste (adapted from https://github.com/ahuth/brackets-paste-and-indent/blob/master/main.js)
    cm.on("change", function(codeMirror, change) {// code duoc them vao
        if(change.origin !== "paste") {
            return;
        }

        var lineFrom = change.from.line;
        var lineTo = change.from.line + change.text.length;

        function reindentLines(codeMirror, lineFrom, lineTo) {
            codeMirror.operation(function() {
                codeMirror.eachLine(lineFrom, lineTo, function(lineHandle) {
                    codeMirror.indentLine(lineHandle.lineNo(), "smart");
                });
            });
        }

        reindentLines(codeMirror, lineFrom, lineTo);
    });

    var reset = function() {// thong tin code viet san 
        cm.setValue($("#default-elev-implementation").text().trim());
    };
    var saveCode = function() {// luu code moi vao csdl tinh
        localStorage.setItem(lsKey, cm.getValue());
        $("#save_message").text("Code saved " + new Date().toTimeString());
        returnObj.trigger("change");
    };

    var existingCode = localStorage.getItem(lsKey);
    if(existingCode) {
        reset();// doan nay bo dang cho tu dong chay khong tinh den cac function khac.
        //cm.setValue(existingCode);
    } else {
        reset();
    }

    $("#button_save").click(function() {
        saveCode();
        cm.focus();
    });

    $("#button_reset").click(function() {// reset code lai code ban dau.
        if(confirm("Ban co muon quay lai code mac dinh ?")) {
            localStorage.setItem("develevateBackupCode", cm.getValue());
            reset();
        }
        cm.focus();
    });

    $("#button_resetundo").click(function() {
        if(confirm("ban co muon chuyen ve code truoc do ?")) {
            cm.setValue(localStorage.getItem("develevateBackupCode") || "");
        }
        cm.focus();
    });

    var returnObj = riot.observable({});
    var autoSaver = _.debounce(saveCode, 1000);
    cm.on("change", function() {
        autoSaver();
    });

    returnObj.getCodeObj = function() {
        //console.log("Getting code...");
        var code = cm.getValue();
        var obj;
        try {
            obj = getCodeObjFromCode(code);
            returnObj.trigger("code_success");
        } catch(e) {
            returnObj.trigger("usercode_error", e);
            return null;
        }
        return obj;
    };
    returnObj.setCode = function(code) {
        cm.setValue(code);
    };
    returnObj.getCode = function() {
        return cm.getValue();
    }
    returnObj.setDevTestCode = function() {
        cm.setValue($("#devtest-elev-implementation").text().trim());
    }

    $("#button_apply").click(function() {
        returnObj.trigger("apply_code");
    });
    return returnObj;
};


var createParamsUrl = function(current, overrides) {
    return "#" + _.map(_.merge(current, overrides), function(val, key) {
        return key + "=" + val;
    }).join(",");
};



$(function() {
    var tsKey = "elevatorTimeScale";
    var editor = createEditor();

    var params = {};

    var $world = $(".innerworld");
    var $stats = $(".statscontainer");// bang hien thi thong so nguoi dung
    var $feedback = $(".feedbackcontainer");// khong
    var $challenge = $(".challenge");// hien thi changllenge
    var $codestatus = $(".codestatus");// bo di

    var floorTempl = document.getElementById("floor-template").innerHTML.trim();// lay  code phan floor
    var elevatorTempl = document.getElementById("elevator-template").innerHTML.trim();
    var elevatorButtonTempl = document.getElementById("elevatorbutton-template").innerHTML.trim();// trim=split=bo qua
    var userTempl = document.getElementById("user-template").innerHTML.trim();
    var challengeTempl = document.getElementById("challenge-template").innerHTML.trim();
    var feedbackTempl = document.getElementById("feedback-template").innerHTML.trim();
    var codeStatusTempl = document.getElementById("codestatus-template").innerHTML.trim();

    var app = riot.observable({});
    app.worldController = createWorldController(1.0 / 60.0);
    app.worldController.on("usercode_error", function(e) {
        console.log("World raised code error", e);
        editor.trigger("usercode_error", e);
    });

    //console.log(app.worldController);
    app.worldCreator = createWorldCreator();
    app.world = undefined;

    app.currentChallengeIndex = 0;

    app.startStopOrRestart = function() {
        if(app.world.challengeEnded) {
            app.startChallenge(app.currentChallengeIndex);
        } else {
            app.worldController.setPaused(!app.worldController.isPaused);
        }
    };

    app.startChallenge = function(challengeIndex, autoStart) {// bat dau challenge voi nhung moc moi//19
        if(typeof app.world !== "undefined") {
            app.world.unWind();
            // TODO: kiem tra lai bo nho neu bi tran !here.
        }
        app.currentChallengeIndex = challengeIndex;
        app.world = app.worldCreator.createWorld(challenges[challengeIndex].options);
        window.world = app.world;

        clearAll([$world, $feedback]);
        presentStats($stats, app.world);
        presentChallenge($challenge, challenges[challengeIndex], app, app.world, app.worldController, challengeIndex + 1, challengeTempl);
        presentWorld($world, app.world, floorTempl, elevatorTempl, elevatorButtonTempl, userTempl);

        app.worldController.on("timescale_changed", function() {
            localStorage.setItem(tsKey, app.worldController.timeScale);
            presentChallenge($challenge, challenges[challengeIndex], app, app.world, app.worldController, challengeIndex + 1, challengeTempl);
        });

        // app.world.on("stats_changed", function() {
        //     var challengeStatus = challenges[challengeIndex].condition.evaluate(app.world);
        //     if(challengeStatus !== null) {
        //         app.world.challengeEnded = true;
        //         app.worldController.setPaused(true);
        //         if(challengeStatus) {
        //             presentFeedback($feedback, feedbackTempl, app.world, "Success!", "Challenge completed", createParamsUrl(params, { challenge: (challengeIndex + 2)}));
        //         } else {
        //             presentFeedback($feedback, feedbackTempl, app.world, "Challenge failed", "Maybe your program needs an improvement?", "");
        //         }
        //     }
        // });

        var codeObj = editor.getCodeObj();
        //console.log("Starting...");
        app.worldController.start(app.world, codeObj, window.requestAnimationFrame, autoStart);
    };

    editor.on("apply_code", function() {
        app.startChallenge(app.currentChallengeIndex, true);
    });
    editor.on("code_success", function() {
        presentCodeStatus($codestatus, codeStatusTempl);
    });
    editor.on("usercode_error", function(error) {
        presentCodeStatus($codestatus, codeStatusTempl, error);
    });
    editor.on("change", function() {
        $("#fitness_message").addClass("faded");
        var codeStr = editor.getCode();
        // fitnessSuite(codeStr, true, function(results) {
        //     var message = "";
        //     if(!results.error) {
        //         message = "Fitness avg wait times: " + _.map(results, function(r){ return r.options.description + ": " + r.result.avgWaitTime.toPrecision(3) + "s" }).join("&nbsp&nbsp&nbsp");
        //     } else {
        //         message = "Could not compute fitness due to error: " + results.error;
        //     }
        //     $("#fitness_message").html(message).removeClass("faded");
        // });
    });
    editor.trigger("change");

    riot.route(function(path) {
        params = _.reduce(path.split(","), function(result, p) {
            var match = p.match(/(\w+)=(\w+$)/);
            if(match) { result[match[1]] = match[2]; } return result;
        }, {});
        var requestedChallenge = 19;
        var autoStart = false;
        var timeScale = parseFloat(localStorage.getItem(tsKey)) || 2.0;
        _.each(params, function(val, key) {
            if(key === "challenge") {
                requestedChallenge = _.parseInt(val) - 1;
                if(requestedChallenge < 0 || requestedChallenge >= challenges.length) {
                    console.log("Invalid challenge index", requestedChallenge);
                    console.log("Defaulting to first challenge");
                    requestedChallenge = 0;
                }
            } else if(key === "autostart") {
                autoStart = val === "false" ? false : true;
            } else if(key === "timescale") {
                timeScale = parseFloat(val);
            } else if(key === "devtest") {
                editor.setDevTestCode();
            } else if(key === "fullscreen") {
                makeDemoFullscreen();
            }
        });
        app.worldController.setTimeScale(timeScale);
        app.startChallenge(requestedChallenge, autoStart);
    });
});
