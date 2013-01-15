/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

COLORS = 6;
GEM_BOARD_WIDTH = 7;
GEM_BOARD_HEIGHT = 7;
TUG_BOARD_WIDTH = 7;
TUG_BOARD_HEIGHT = 7;

/*
* Gem game flow:
* 0. Generate board
* 1. Click two pieces.
* 2. If adjacent, continue. Otherwise, wait for 1.
* 3. If k>=3 of same color adjacent vertically or horizontally, continue. Otherwise, do not swap, wait for 1.
* 4. Kill k pieces, compute new vertical or horizontal pieces to fill at top of columns in model. Spawn appropriate unit
* counts given the number of pieces killed by placing them into the unit queue.
* 5. Kill k divs, generate new divs, run animation events, register animation on-complete events.
* 6. On animation complete, go to 3 to check the new board.
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
    this.life = [20, 20];
    this.unitQueues = [[], []];
    this.secondsPerTileMoveSpeed = 2;
    this.closed = false;
}

var GEM_SCHEMA = function() {
    this.color = 0;
}

var UNIT_SCHEMA = function() {
    this.user = BUNNY || FARMER;
    this.x = 0;
    this.y = 0;
    this.color = 0;
    this.evaluated = false;
    this.gettingKilled = false;
    this.killPoint = [0,0];
}

// Main collection containing games
Games = new Meteor.Collection("games");

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
    return board;
}

var generateNbyN = function(width,height) {
    var board = [];
    for (var y = 0; y < height; y++) {
        board.push(_.range(width));
    }
    return board;
}

Meteor.methods({
    // Join a 1 player game. Otherwise, start a new game and wait. By convention, first player is bunny.
    startGame: function() {
        // Find a 1 player game.
        var g = Games.findOne({$where:"this.users.length < 2",closed:false});

        // Join the game if found.
        if (g) {
            Games.update({"_id":g._id},{$addToSet:{users:this.userId}});
            // Return the game id.
            return g._id;
        }

        // Otherwise, create a new game
        g = new GAME_SCHEMA();
        g.name = "Game #" + (Games.find({}).count() + 1).toString();
        g.gemBoards = [generateGemBoard(GEM_BOARD_WIDTH,GEM_BOARD_HEIGHT,COLORS),generateGemBoard(GEM_BOARD_WIDTH,GEM_BOARD_HEIGHT,COLORS)];
        g.users = [this.userId];

        var gameId = Games.insert(g);
        return gameId;
    }
});