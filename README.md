# TagproRegrabChecker

Userscript that interacts with the multiplayer capture the flag game Tagpro (found at tagpro.gg)

To install, you must have Tampermonkey installed for Chrome, or Greasemonkey for Firefox. Simply copy the code from 
regrabuserscript.js, create a new script in Tampermonkey/Greasemonkey, and paste. Now the script will run on all tagpro sites.

In Tagpro, "regrab" is the strategy of keeping one team member on the opposing team's flag tile to prevent the opposing team from scoring while also allowing for the quick recapture of the enemy's flag. 

This script creates a Pixi.js text object and places it relative to the game's scoreboard. It then  listens for player updates regarding the capture or return of flags to determine if the enemy flag is currently held by a player on your team. If so, every UI update, the script checks the location of players on your team (not including the flag carrier) to determine if someone is within 2 tiles of the desired flag tile in both the x and y directions. Depending on where players are and if the enemy flag is currently held by one of our team's players, the script updates the text object with the correct message and visiblity setting.

The player only receives map updates for tiles his character can see, while player updates are received regardless, which is why player updates is the better option for monitoring flag states.
