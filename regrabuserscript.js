// ==UserScript==
// @name        Tagpro ReGrab Checker
// @namespace   seanf80
// @version     1.0
// @include     http://tagpro-*.koalabeast.com:*
// @include     http://tagpro-maptest.koalabeast.com:*/
// @include     http://tangent.jukejuice.com:* 
// @include     http://maptest*.newcompte.fr:* 
// @grant       none
// ==/UserScript==



//registers our function with the game by passing it into tagpro.ready when the objects we need are initialized
//tagpro.ready registers our_function and calls it when the game is ready for userscripts to execute
function addToTagpro(our_function) {
    if (typeof tagpro.map !== "undefined" && typeof tagpro.ui.sprites.redScore !== "undefined") {
        tagpro.ready(our_function);
    } else {
        //if not ready, wait and try again
        setTimeout(function() {
            addToTagpro(our_function);
        }, 0);
    }
}


//function that will be passed into addToTagpro
function scriptStartup() {
    //pixi.text object containing the regrab message

    //variable to determine in neutral the flag or capture the flag style map
    var neutralFlag = false;
    
    //get parameters of the map
    var xlen = tagpro.map.length;
    var ylen = xlen > 0 ? tagpro.map[0].length : -1;
    
    
    //returns correct coordinates for enemy flag
    function findRegrabCoords() {
        if (neutralFlag) {
            return flag_locations.yellow;
        } else if (teamValue === 1) { //1 represents on red team, so return location of enemy flag (blue)
            return flag_locations.blue;
        } else { //else player is on blue, return red flag location
            return flag_locations.red;
        }
    }
    
    //object holding flag locations
    var flag_locations = {
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

    //object used to set Pixi text object style
    var style = {
        font: "bold 10pt Arial",
        align: "center",
        stroke: "#000000",
        strokeThickness: 3,
        fill : "#FF0000",
    };
    
    //find flag location for flags
    //the tagpro.map x and y represent tiles that are 40 by 40 pixels
    //To get pixel value, times by 40 to get bottom left corner and add 20 to x and y to get center pixel value
    for (var i = 0; i<xlen; i++) {
        for (var j = 0; j<ylen; j++) {
            if (tagpro.map[i][j] === 3 || tagpro.map[i][j] === 3.1) {
                flag_locations.red.x = i*40;
                flag_locations.red.y = j*40;
            }
            if (tagpro.map[i][j] === 4 || tagpro.map[i][j] === 4.1) {
                flag_locations.blue.x = i*40;
                flag_locations.blue.y = j*40;
            }
            if (tagpro.map[i][j] === 16 || tagpro.map[i][j] === 16.1) {
                flag_locations.yellow.x = i*40;
                flag_locations.yellow.y = j*40;
                neutralFlag = true;
            }
        }
    }

    //Pixi text object containing the regrab message
    var FCtext = new PIXI.Text("We Need Regrab!", style);
    FCtext.visible = false;
    tagpro.renderer.layers.ui.addChild(FCtext);
    
    //flag starts out in base
    var enemyFlagTaken = false;
    
    //(team -> red = 1, blue = 2), get value from the Player object's team property
    var teamValue = tagpro.players[tagpro.playerId].team;
    var regrabCoords = findRegrabCoords();
    
    //listen for all grabbed/dropped flag updates for player's own team
    tagpro.socket.on("p", function(allupdates) {
        //the property u is an array that contains all updates to be applied to players
        //sets allupdates equal to that array if not null/undefined
        allupdates = allupdates.u || allupdates;
        allupdates.forEach( function checkflagplayer(update) {
            if (update.hasOwnProperty("flag")) {
                //use id from update to get team value for the specific player update is applied to get team value of self
                var playerteam = tagpro.players[update.id].team;            
                if (playerteam === teamValue) {
                    if (update.flag) {
                        enemyFlagTaken = true;
                        FCtext.visible = true;
                    }
                    else {
                        enemyFlagTaken = false;
                        FCtext.visible = false;
                    }
                }
            }
            
            //if player switches team (red = 1, blue = 2), switch teamValue, where 1 becomes 2 and 2 becomes 1
            if (update.hasOwnProperty("team") && update.id === tagpro.playerId) {
                teamValue = 3 - teamValue;
                enemyFlag = findRegrabCoords();
            }
        });
    });
    
    //update x and y so that our regrab sprite is always centered between the red and blue scores
    var alignUI = tagpro.ui.alignUI;
    tagpro.ui.alignUI = function() {
        FCtext.x = ((tagpro.ui.sprites.redScore.x + tagpro.ui.sprites.blueScore.x)/2) - (FCtext.width/2);
        FCtext.y = ((tagpro.ui.sprites.redScore.y + tagpro.ui.sprites.blueScore.y)/2) - (FCtext.height/2);
        alignUI.apply(null, arguments);
    }
    
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
                        
                        var x_dist = Math.abs(player.x - regrabCoords.x);
                        var y_dist = Math.abs(player.y - regrabCoords.y);
                        
                        var allowableNumTiles = 2;
                        
                        //check to see if player is within allowable number of tiles (40 pixels each) in both x and y directions
                        if (x_dist <= allowableNumTiles*40 && y_dist <= allowableNumTiles*40 && !player.flag) {
                            foundRe = true;
                            style.font = "bold 10pt Arial";
                            style.fill = "#00FF00";
                            FCtext.setText("RE: " + player.name );
                            FCtext.setStyle(style);
                        }
                    }
                }
            }
           
           //if no one is one regrab, update text object and set visible to true
            if (!foundRe) {
                style.fill = "#FF9900";
                style.font = "bold 14pt Arial";
                FCtext.setText("We Need Regrab!");
                FCtext.setStyle(style);
                FCtext.visible = true;
            }
        }
        updateUI.apply(null, arguments);
    };

}

//call addToTagpro
addToTagpro(scriptStartup);