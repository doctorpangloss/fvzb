/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

COLORS = 6;
GEM_BOARD_WIDTH = 7;
GEM_BOARD_HEIGHT = 7;
TUG_BOARD_WIDTH = 7;
TUG_BOARD_HEIGHT = 7;
// How many milliseconds do we wait until we check the gemboard again for cascades? Used for animation too.
GEM_BOARD_NEXT_EVALUATION_DELAY = 400;

/*
* Gem game flow:
* 0. Generate board
* 1. Click two pieces.
* 2. If adjacent, continue. Otherwise, wait for 1.
* 3. If k>=3 of same color adjacent vertically or horizontally, continue. Otherwise, do not swap, wait for 1.
* 4. Kill k gems, compute new vertical  gems to fill at top of columns in model. Spawn appropriate unit
* counts given the number of pieces killed by placing them into the unit queue.
* 5. Kill k divs, generate new divs, run animation events, register animation on-complete events.
* 6. On animation complete/after a built-in model delay, go to 3 to check the new board.
*
* Tug of war game flow:
* 0. Clear game board
* 1. On each timestep:
* 2. Place queue units into empty spots on game board and empty the queue, if possible.
* 3. For each piece:
* 4. Is a complementary, enemy, unevaluated piece sharing the same row, a row above or a row below? If so, continue.
* Otherwise, skip to 6.
* 5. If so, mark both pieces to be killed. If it's the same row, mark the pieces to be animated with horizontal movement
* towards the midpoint. If +/-1 row, calculate a move towards a "half row."
* 6. If not complementary, enemy, unevaluated piece sharing rows i-1 to i+1, mark the piece to be animated moving in the
* opponent's direction.
* 7. If all pieces are evaluated, continue. Otherwise, go back to 3.
* 8. Execute animations and update states. Go back to 1.
* */

// By convention, 0th element is always Bunny. 1st element is always Farmer.
BUNNY = 0;
FARMER = 1;
var GAME_SCHEMA = function() {
    this.name = "";
    this.gemBoards = [[[]], [[]]];
    // Array of units
    this.tugBoard = [];
    this.users = [];
    // Get which role the user is playing
    this.roles = {};
    this.life = [20, 20];
    this.unitQueues = [[], []];
    this.secondsPerTileMoveSpeed = 2;
    this.closed = false;
};

var UNIT_SCHEMA = function() {
    this.user = BUNNY || FARMER;
    this.x = 0;
    this.y = 0;
    this.color = 0;
    this.evaluated = false;
    this.gettingKilled = false;
    this.killPoint = [0,0];
};

// Main collection containing games
Games = new Meteor.Collection("games");

var getGame = function(gameId) {
    return Games.findOne({_id:gameId});
};

var createNewAnonymousUser = function(nickname,callback) {
    nickname = nickname || Math.random().toString(36).slice(-8);
    callback = callback || function(e,r) {console.log(e);};
    var userIdPadding = Math.random().toString(36).slice(-8);
    var password = Math.random().toString(36).slice(-8);
    Accounts.createUser({username:"Anonymous " + userIdPadding, password:password, profile:{name:nickname}},callback);
};

// Gemboards are of the form gemboard[y][x] (row major order)
var generateGemBoard = function(width,height,numColors) {
    var board = [];
    var colors = _.range(numColors);
    // Generate first row, from which to derive future rows (base case)
    board.push(
        _.map(_.range(width), function() {
            return Math.floor(Math.random()*COLORS);
        })
    );
    for (var y = 1; y < height; y++) {
        // Generate a row where each element is not the same as an adjacent element and different from the element above
        // First, the base case, the first element of the row, is placed into the memo. Then, the array we're computing
        // on is our row above. Finally, append to the board a new row that satisfies the conditions above.
        board.push(
            _.reduce(
                // For each piece above
                board[y-1].slice(1),
                function(row /*Memo*/,above /*The next piece above*/) {
                    // Place a piece that is not the adjacent piece or a piece above
                    var left = row[row.length-1];
                    // Extend the memo row with a random color that isn't the above color or the left color;
                    return row.concat([_.first(_.shuffle(_.without(colors,above,left)))]);
                },
                // First element of the row is populated as our memo
                [_.first(_.shuffle(_.without(colors,board[y-1][0])))]
            )
        );
    }

    // TODO _.zip.apply(_, board) to convert from row major to column major, or change above code
    return board;
};

var generateNbyN = function(width,height) {
    var board = [];
    for (var y = 0; y < height; y++) {
        board.push(_.map(_.range(width),function(o) {return 0;}));
    }
    return board;
};

// Returns a cloned gemboard with the given tiles swapped
var swap = function(gemboard,ax,ay,bx,by) {
    // jQuery array clone hack
    var gemboardClone = $.extend(true,[],gemboard);
    gemboardClone[by][bx] = gemboard[ay][ax];
    gemboardClone[ay][ax] = gemboard[by][bx];
    return gemboardClone;
};

// Check if a swap is valid by swapping and checking the changed rows and columns
var isSwapValid = function(gemboard,ax,ay,bx,by) {
    var rowMajorGemboard = swap(gemboard,ax,ay,bx,by);

    for (var x = 2; x < GEM_BOARD_WIDTH; x++) {
        if ((rowMajorGemboard[ay][x-2] == rowMajorGemboard[ay][x-1] == rowMajorGemboard[ay][x-1]) ||
            (rowMajorGemboard[by][x-2] == rowMajorGemboard[by][x-1] == rowMajorGemboard[by][x-1])) {
            return true;
        }
    }

    for (var y = 2; y < GEM_BOARD_HEIGHT; y++) {
        if ((rowMajorGemboard[y-2][ax] == rowMajorGemboard[y-1][ax] == rowMajorGemboard[y][ax]) ||
            (rowMajorGemboard[y-2][bx] == rowMajorGemboard[y-1][bx] == rowMajorGemboard[y][bx])) {
            return true;
        }
    }

    return false;
};

var calculateTugs = function(colorsDestroyed,bunnyOrFarmer) {
    var tugs = [];
    for (var color = 0; color < COLORS; color++) {
        for (var count = 0; count < colorsDestroyed[color]; count++) {
            var unit = new UNIT_SCHEMA()
            unit.color = color;
            unit.user = bunnyOrFarmer;

            // TODO
            tugs.push(unit);
        }
    }
};

var evaluateGemboard = function(rowMajor) {
    // Is there any activity due to destruction?
    var activity = false;
    // Bitmap of tiles to destroy
    var destroyedTiles = generateNbyN(GEM_BOARD_WIDTH,GEM_BOARD_HEIGHT);
    // Number of each color destroyed, indexed by color
    var colorsDestroyed = _.map(_.range(COLORS),function () {return 0;});
    // Emptied gemboard
    var columnMajorNewGemboard = [];
    // Replacement gems per column
    var replacementGemsPerColumn = [];

    // Get 3+ contiguous elements in rows
    for (var y = 0; y < GEM_BOARD_HEIGHT; y++) {
        for (var x = 2; x < GEM_BOARD_WIDTH; x++) {
            // If three are adjacent, get the color and add the tiles to destroyables
            if (rowMajor[y][x-2] == rowMajor[y][x-1] == rowMajor[y][x]) {
                activity = true;
                colorsDestroyed[rowMajor[y][x]]++;
                destroyedTiles[y,x] = 1;
                destroyedTiles[y,x-1] = 1;
                destroyedTiles[y,x-2] = 1;
            }
        }
    }

    // Get 3+ contiguous elements in columns
    for (var x = 0; x < GEM_BOARD_WIDTH; x++) {
        for (y = 2; y < GEM_BOARD_HEIGHT; y++) {
            if (rowMajor[y][x] == rowMajor[y-1][x] == rowMajor[y-2][x]) {
                activity = true;
                colorsDestroyed[rowMajor[y][x]]++;
                destroyedTiles[y,x] = 1;
                destroyedTiles[y-1,x] = 1;
                destroyedTiles[y-2,x] = 1;
            }
        }
    }

    // TODO: Make gemboard algorithm that works in row major, or convert row major gemboards to column major
    // Create new gemboard
    for (var x = 0; x < GEM_BOARD_WIDTH; x++) {
        columnMajorNewGemboard.push([]);
        replacementGemsPerColumn.push([]);
        for (var y = 0; y < GEM_BOARD_HEIGHT; y++) {
            if (!destroyedTiles[y][x]) {
                // Will push down the column later
                columnMajorNewGemboard[x].push(rowMajor[y][x]);
                // Using these replacement gems
                replacementGemsPerColumn[x].push(Math.floor(Math.random()*COLORS));
            }
        }

        // Add the gems in (push down the column of gems)
        for (var i = replacementGemsPerColumn[x].length-1; i >=0; i--) {
            columnMajorNewGemboard[x].unshift(replacementGemsPerColumn[x][i])
        }
    }

    // Generate a row major version of the new gemboard (some kind of UnderscoreJS wizardry)
    var rowMajorNewGemboard = _.zip.apply(_, columnMajorNewGemboard);

    // A doozy of a control structure, but has to be computed somewhere.
    return {activity:activity,destroyedTiles:destroyedTiles,colorsDestroyed:colorsDestroyed,
        rowMajorNewGemboard:rowMajorNewGemboard,replacementGemsPerColumn:replacementGemsPerColumn};
}

Meteor.methods({
    // Join a 1 player game. Otherwise, start a new game and wait. By convention, first player is bunny.
    startGame: function() {
        // Find a 1 player game.
        var g = Games.findOne({$where:"this.users.length < 2",closed:false});

        // Join the game if found.
        if (g) {
            var roles = g.roles;
            if (!roles[this.userId])
                roles[this.userId] = 1;
            Games.update({"_id":g._id},{$addToSet:{users:this.userId},$set:{roles:roles}});
            // Return the game id.
            return g._id;
        }

        // Otherwise, create a new game
        g = new GAME_SCHEMA();
        g.name = "Game #" + (Games.find({}).count() + 1).toString();
        g.gemBoards = [generateGemBoard(GEM_BOARD_WIDTH,GEM_BOARD_HEIGHT,COLORS),generateGemBoard(GEM_BOARD_WIDTH,GEM_BOARD_HEIGHT,COLORS)];
        g.users = [this.userId];
        g.roles[this.userId] = 0;
        var gameId = Games.insert(g);
        return gameId;
    },

    // Test a swap and return true if it satisfies conditions
    swap: function(gameId,ax,ay,bx,by) {
        var g = getGame(gameId);

        if (!g)
            throw new Meteor.Error(404,"The game cannot be found");

        if (g.closed)
            throw new Meteor.Error(403,"The game is closed.");

        if (_.indexOf(g.users,this.userId) == -1)
            throw new Meteor.Error(403,"You are not in this game.");

        var isSwapValid = isSwapValid(g.gemBoards[g.roles[this.userId]],ax,ay,bx,by);

        // Is the swap valid? If so, update the gemboard and return true. Otherwise return false. The client is expected
        // to call evaluate when it's ready.
        if (isSwapValid) {
            var boardUpdate = {};
            boardUpdate["gemBoards." + g.roles[this.userId].toString()] = swap(g.gemBoards[g.roles[this.userId]],ax,ay,bx,by);
            Games.update({_id:gameId},{$set:boardUpdate});
            return true;
        } else {
            return false;
        }
    },

    // Evaluate the gemboard and return a results object used for animation and more evaluation.
    evaluate: function(gameId) {
        var g = getGame(gameId);

        if (!g)
            throw new Meteor.Error(404,"The game cannot be found");

        if (g.closed)
            throw new Meteor.Error(403,"The game is closed.");

        if (_.indexOf(g.users,this.userId) == -1)
            throw new Meteor.Error(403,"You are not in this game.");

        var evaluation = evaluateGemboard(g.gemBoards[g.roles[this.userId]]);

        // Was something destroyed?
        if (evaluation.activity) {
            // An object used for animation.
            var results = {kill:[],replacementGemsPerColumn:[]};
            // Return a results object for the client. The client does this evaluation immediately after swapping.
            for (var y = 0; y < GEM_BOARD_WIDTH; y++) {
                for (var x = 0; x < GEM_BOARD_HEIGHT; x++) {
                    if (evaluation.destroyedTiles[y][x])
                        results.kill.push({x:x,y:y});
                }
            }

            // If this is a simulation, return the kill part of the results, because we're waiting on the replacement
            // gems anyway and do not want to update the boards.
            if (this.isSimulation)
                return results;

            results.replacementGemsPerColumn = evaluation.replacementGemsPerColumn;

            // Update gemboard
            var boardUpdate = {};
            boardUpdate["gemBoards." + g.roles[this.userId].toString()] = results.rowMajorNewGemboard;
            Games.update({_id:gameId},{$set:boardUpdate});

            return results;
        }

        // No activity was recorded. Return false to let the client know: stop checking.
        return false;
    }
});