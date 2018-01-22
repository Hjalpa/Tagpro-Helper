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
            setTimeout(function() {
                addToTagpro(helperScript);
            }, 100);
        }
    }


    //function that will be passed into addToTagpro
    function scriptStartup() {

        //returns correct coordinates for flag of opposing teamteam
        function findEnemyFlag(flagLocations, teamValue) {
            if (neutralFlag) {
                return flagLocations.yellow;
            } else if (teamValue === red) {
                return flagLocations.blue;
            } else {
                return flagLocations.red;
            }
        }

        //find flag location for flags
        //the tagpro.map x and y represent tiles that are 40 by 40 pixels
        //To get pixel value, times by 40 to get bottom left corner and add 20 to x and y to get center pixel value

        function updateFlagLocations(flagLocations) {
            for (var i = 0; i<xlen; i++) {
                for (var j = 0; j<ylen; j++) {
                    if (tagpro.map[i][j] === 3 || tagpro.map[i][j] === 3.1) {
                        flagLocations.red.x = i*TILE_PIXELS;
                        flagLocations.red.y = j*TILE_PIXELS;
                    }
                    if (tagpro.map[i][j] === 4 || tagpro.map[i][j] === 4.1) {
                        flagLocations.blue.x = i*TILE_PIXELS;
                        flagLocations.blue.y = j*TILE_PIXELS;
                    }
                    if (tagpro.map[i][j] === 16 || tagpro.map[i][j] === 16.1) {
                        flagLocations.yellow.x = i*TILE_PIXELS;
                        flagLocations.yellow.y = j*TILE_PIXELS;
                        neutralFlag = true;
                    }
                }
            }
            return flagLocations;
        }

        // Tagpro values
        const RED = 1;
        const BLUE = 2;
        const ALLOWABLE_REGRAB_TILES = 2;
        const TILE_PIXELS = 40; //width/height of tagpro tile in pixels
        const REGRAB_MESSAGE = "We Need Regrab!";
        const ON_RE = "RE: ";

        //get parameters of the map
        var xlen = tagpro.map.length;
        var ylen = xlen > 0 ? tagpro.map[0].length : -1;

        //other game stats
        var playerID = tagpro.playerId;
        var neutralFlag = false; //indicates if this a neutral (1-Flag game) or 2-Flag game
        var enemyFlagTaken = false; //flag starts out in base
        var ownFlagTake = false;
        var teamValue = tagpro.players[playerID].team; //get value from the Player object's team property

        //object holding flag locations
        var flagLocations = {
            red : {
                x : -1,
                y : -1
            },
            blue : {
                x : -1,
                y : -1
            },
            yellow : {
                x : -1,
                y : -1
            }
        };
        //set flagLocations
        updateFlagLocations(flagLocations);
        var enemyFlag = findEnemyFlag(flagLocations, teamValue);


        //object used to set Pixi text object style
        var onRegrabStyle = {
            font: "bold 10pt Arial",
            align: "center",
            stroke: "#000000",
            strokeThickness: 3,
            fill : "#FF0000",
        };

        var needRegrabStyle = {
            font: "bold 14pt Arial",
            align: "center",
            stroke: "#000000",
            strokeThickness: 3,
            fill : "#FF9900",
        };

        //Pixi text object containing the regrab message
        var FCtext = new PIXI.Text(REGRAB_MESSAGE, needRegrabStyle);
        FCtext.visible = false;
        tagpro.renderer.layers.ui.addChild(FCtext);

        //listen for all grabbed/dropped flag updates for player's own team
        tagpro.socket.on("p", function(info) {
            //the property u is an array that contains all updates to be applied to players
            let updates = info.u || info;
            updates.forEach( function checkflagplayer(update) {
                if (update.hasOwnProperty("flag")) {
                    //use id from update to get team value for the specific player update is applied to get team value of self
                    var playerTeam = tagpro.players[update.id].team;
                    if (playerTeam === RED && update.flag) {
                        redFlagTaken = true;
                    } else {
                        enemyFlagTaken = false;
                    }
                }

                //if player switches team, switch teamValue
                //red + blue = some odd number, so subtracting by the current team will return the new team
                if (update.hasOwnProperty("team") && update.id === playerID) {
                    teamValue = (RED + BLUE) - teamValue;
                    enemyFlag = findEnemyFlag(teamValue);
                }
            });
        });

        //update x and y so that our regrab sprite is always centered between the red and blue scores
        var alignUI = tagpro.ui.alignUI;
        tagpro.ui.alignUI = function() {
            FCtext.x = ((tagpro.ui.sprites.redScore.x + tagpro.ui.sprites.blueScore.x)/2) - (FCtext.width/2);
            FCtext.y = ((tagpro.ui.sprites.redScore.y + tagpro.ui.sprites.blueScore.y)/2) - (FCtext.height/2);
            alignUI.apply(null, arguments);
        };

        //determine what message to display and update our regrab sprite every time the UI updates
        var updateUI = tagpro.ui.update;
        tagpro.ui.update = function(layer, origin) {
            if (enemyFlagTaken) {
                var foundRe = false;
                //tagpro.players contains 1 Player object for each player, whose unique id is the key inside tagpro.players object
                //loop through the players inside tagpro.players, searching for teammate on "regrab" (within 2 tiles f flag in x and y direction)
                for (var id in tagpro.players) {
                    if (tagpro.players.hasOwnProperty(id)) {
                        var player = tagpro.players[id];
                        //confirm player is on your team
                        if (player.team === teamValue) {

                            var x_dist = Math.abs(player.x - enemyFlag.x);
                            var y_dist = Math.abs(player.y - enemyFlag.y);

                            //check to see if player is within allowable number of tiles (40 pixels each) in both x and y directions
                            if (x_dist <= ALLOWABLE_REGRAB_TILES*TILE_PIXELS && y_dist <= ALLOWABLE_REGRAB_TILES*TILE_PIXELS && !player.flag) {
                                foundRe = true;
                                FCtext.setText(ON_RE + player.name );
                                FCtext.setStyle(style);
                            }
                        }
                    }
                }

               //if no one is one regrab, update text object and set visible to true
                if (!foundRe) {
                    FCtext.setText(TILE_PIXELS);
                    FCtext.setStyle(regrabStyle);
                    FCtext.visible = true;
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