// ==UserScript==
// @name        Tagpro ReGrab Checker
// @namespace   seanf80
// @version     1.0
// @include     http://tagpro-*.koalabeast.com:*
// @include     http://tagpro-maptest.koalabeast.com:*/
// @include     http://tangent.jukejuice.com:*
// @include     http://maptest*.newcompte.fr:*
// @require      https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/6.18.2/babel.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/babel-polyfill/6.16.0/polyfill.js
// @match        http://*/*
// @grant       none
// ==/UserScript==



//registers our function with the game by passing it into tagpro.ready when the objects we need are initialized
//tagpro.ready registers our_function and calls it when the game is ready for userscripts to execute

/* jshint ignore:start */
var inline_src = (<><![CDATA[
    /* jshint ignore:end */
    /* jshint esnext: false */
    /* jshint esversion: 6 */
    function addToTagpro(helperScript) {
        if (typeof tagpro.map !== "undefined" && typeof tagpro.ui.sprites.redScore !== "undefined") {
            tagpro.ready(helperScript);
        } else {
            //if not ready, wait and try again
            setTimeout(() => {
                addToTagpro(helperScript)
            }, 100);
        }
    }

    //function that will be passed into addToTagpro
    function scriptStartup() {

        // Tagpro values
        const YELLOW = 0;
        const RED = 1;
        const BLUE = 2;
        const NUM_FLAGS = 3;
        const ALLOWABLE_REGRAB_TILES = 2;
        const TILE_PIXELS = 40; //width/height of tagpro tile in pixels
        const NEED_REGRAB_MESSAGE = "We Need Regrab!";
        const ON_RE = "RE: ";

        //flag constants
        const RED_FLAG = 3;
        const RED_FLAG_TAKEN = 3.1;
        const BLUE_FLAG = 4;
        const BLUE_FLAG_TAKEN = 4.1;
        const YELLOW_FLAG = 16;
        const YELLOW_FLAG_TAKEN = 16.1;

        //find flag location for flags
        //the tagpro.map x and y represent tiles that are 40 by 40 pixels
        //To get pixel value, times by 40 to get bottom left corner and add 20 to x and y to get center pixel value
        function updateFlagLocations(gameState) {
            for (var i = 0; i<xlen; i++) {
                for (var j = 0; j<ylen; j++) {
                    if (tagpro.map[i][j] === RED_FLAG || tagpro.map[i][j] === RED_FLAG_TAKEN) {
                        gameState.flags[RED].x = i*TILE_PIXELS;
                        gameState.flags[RED].y = j*TILE_PIXELS;
                    }
                    if (tagpro.map[i][j] === BLUE_FLAG || tagpro.map[i][j] === BLUE_FLAG_TAKEN) {
                        gameState.flags[BLUE].x = i*TILE_PIXELS;
                        gameState.flags[BLUE].y = j*TILE_PIXELS;
                    }
                    if (tagpro.map[i][j] === YELLOW_FLAG || tagpro.map[i][j] === YELLOW_FLAG_TAKEN) {
                        gameState.flags[YELLOW].x = i*TILE_PIXELS;
                        gameState.flags[YELLOW].y = j*TILE_PIXELS;
                        gameState.neutralFlag = true;
                    }
                }
            }
        }

        //get parameters of the map
        var xlen = tagpro.map.length;
        var ylen = xlen > 0 ? tagpro.map[0].length : -1;

        //other game stats
        var playerID = tagpro.playerId;
        var teamValue = tagpro.players[playerID].team; //get value from the Player object's team property

        // initialize flags
        // the flag index in the array corresponds to the flags value
        // aka flags[0] = yellow, flags[1] =red, flags[2] = blue
        var flags = [];
        for (let i = 0; i < NUM_FLAGS; i++) {
            flags.push({
                x : -1,
                y : -1,
                captured: false,
            });
        }

        var gameState = {
            flags: flags,
            neutralFlag: false,
        };

        //set flagLocations
        updateFlagLocations(gameState);
        var enemyTeamID = RED + BLUE - teamValue;
        var regrabFlagID = gameState.neutralFlag ? YELLOW : enemyTeamID;

        // objects used to set Pixi text object style
        var onRegrabStyle = {
            font: "bold 10pt Arial",
            align: "center",
            stroke: "#000000",
            strokeThickness: 3,
            fill: "#00FF00"
        };

        var needRegrabStyle = {
            font: "bold 14pt Arial",
            align: "center",
            stroke: "#000000",
            strokeThickness: 3,
            fill: "#FF9900"
        };

        //Pixi text object containing the regrab message
        var needRegrabPixi = new PIXI.Text(NEED_REGRAB_MESSAGE, needRegrabStyle);
        needRegrabPixi.visible = false;
        tagpro.renderer.layers.ui.addChild(needRegrabPixi);

        //listen for all grabbed/dropped flag updates for player's own team
        tagpro.socket.on("p", function(info) {
            //the property u is an array that contains all updates to be applied to players
            let updates = info.u || info;
            updates.forEach( function checkflagplayer(update) {
                if (update.hasOwnProperty("flag")) {
                    //get flagid from team value for the player
                    var flagID = gameState.neutralFlag ? YELLOW : RED + BLUE - tagpro.players[update.id].team;
                    var flagTaken = false;
                    if (update.flag) {
                        flagTaken = true;
                        needRegrabPixi.visible = true;
                    } else {
                        needRegrabPixi.visible = false;
                    }
                    gameState.flags[flagID].captured = flagTaken;
                }

                //if player switches team, switch teamValue and update enemy flag
                //red + blue = some odd number, so subtracting by the current team will return the new team
                if (update.hasOwnProperty("team") && update.id === playerID) {
                    let temp = enemyTeamID;
                    enemyTeamID = teamValue;
                    teamValue = temp;
                    if (!gameState.neutralFlag)
                    {
                        regrabFlagID = enemyTeamID;
                    }
                }
            });
        });

        //update x and y so that our regrab sprite is always centered between the red and blue scores
        var alignUI = tagpro.ui.alignUI;
        tagpro.ui.alignUI = function() {
            needRegrabPixi.x = ((tagpro.ui.sprites.redScore.x + tagpro.ui.sprites.blueScore.x)/2) - (needRegrabPixi.width/2);
            needRegrabPixi.y = ((tagpro.ui.sprites.redScore.y + tagpro.ui.sprites.blueScore.y)/2) - (needRegrabPixi.height/2);
            alignUI.apply(null, arguments);
        };

        //determine what message to display and update our regrab sprite every time the UI updates
        var updateUI = tagpro.ui.update;
        tagpro.ui.update = function(layer, origin) {
            if (gameState.flags[regrabFlagID].captured) { //gameState.flags[teamValue].captured
                var foundTeamRe = false;
                //tagpro.players contains 1 Player object for each player, whose unique id is the key inside tagpro.players object
                //loop through the players inside tagpro.players, searching for teammate on "regrab" (within 2 tiles f flag in x and y direction)
                for (var id in tagpro.players) {
                    if (tagpro.players.hasOwnProperty(id)) {
                        var player = tagpro.players[id];
                        //confirm player is on your team
                        if (player.team === teamValue) {
                            var x_dist = Math.abs(player.x - gameState.flags[regrabFlagID].x);
                            var y_dist = Math.abs(player.y - gameState.flags[regrabFlagID].y);

                            //check to see if player is within allowable number of tiles (40 pixels each) in both x and y directions
                            if (x_dist <= ALLOWABLE_REGRAB_TILES*TILE_PIXELS && y_dist <= ALLOWABLE_REGRAB_TILES*TILE_PIXELS && !player.flag) {
                                foundTeamRe = true;
                                needRegrabPixi.setText(ON_RE + player.name);
                                needRegrabPixi.setStyle(onRegrabStyle);
                            }
                        }
                    }
                }

               //if no one is one regrab, update text object and set visible to true
                if (!foundTeamRe) {
                    needRegrabPixi.setText(NEED_REGRAB_MESSAGE);
                    needRegrabPixi.setStyle(needRegrabStyle);
                }
            }
            updateUI.apply(null, arguments);
        };

    }

    //call addToTagpro
    addToTagpro(scriptStartup);

/* jshint ignore:start */
]]></>).toString();
var c = Babel.transform(inline_src, { presets: [ "es2015", "es2016" ] });
eval(c.code);
/* jshint ignore:end */