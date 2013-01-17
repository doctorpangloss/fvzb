/**
 * @author Benjamin Berman
 * © 2013 All Rights Reserved
 **/

Array.prototype.clone = function() {
    var arr = this.slice(0);
    for( var i = 0; i < this.length; i++ ) {
        if( this[i].clone ) {
            //recursion
            arr[i] = this[i].clone();
        }
    }
    return arr;
}


COLORS = 4;
GEM_BOARD_WIDTH = 7;
GEM_BOARD_HEIGHT = 7;
TUG_BOARD_WIDTH = 7;
TUG_BOARD_HEIGHT = 7;
// How many milliseconds do we wait until we check the gemBoard again for cascades? Used for animation too.
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
* 4. Is a complementary, enemy, unevaluated piece sharing the same row, a row above or a row below? Or is an enemy unit
* sharing this space? If so, continue. Otherwise, skip to 6.
* 5. If so, mark both pieces to be killed. If it's the same row, mark the pieces to be animated with horizontal movement
* towards the midpoint. If +/-1 row, calculate a move towards a "half row."
* 6. If not complementary, enemy, unevaluated piece sharing rows i-1 to i+1, mark the piece to be animated moving in the
* opponent's direction.
* 7. If all pieces are evaluated, continue. Otherwise, go back to 3.
* 8. Execute animations and update states. Go back to 1.
* */


BUNNY = "bunny";
FARMER = "farmer";
var GAME_SCHEMA = function() {
    this.name = "";
    this.bunny = {
        gemBoard:[[]],
        life:20
    };
    this.farmer = {
        gemBoard:[[]],
        life:20
    };
    this.users = [];
    // Get which role the user is playing
    this.roles = {};
    this.secondsPerTileMoveSpeed = 2;
    this.closed = false;
};

var UNIT_SCHEMA = function() {
    this.gameId = "";
    this.role = BUNNY;
    this.x = 0;
    this.y = 0;
    this.color = 0;
    this.gettingKilled = false;
    // Id of target when assigned.
    this.target = "";
    this.queued = false;
};

// Main collection containing games.
Games = new Meteor.Collection("games");

// Collection containing units per game. Really handy to treat as separate collection.
Units = new Meteor.Collection("units");

var getGame = function(gameId) {
    return Games.findOne({_id:gameId});
};

var getRole = function(gameDocument,userId) {
    return gameDocument.roles[userId];
};

var getGemBoard = function(gameDocument,userId) {
    return gameDocument[getRole(gameDocument,userId)].gemBoard;
};

// GemBoards are of the form gemBoard[y][x] (row major order)
var generateGemBoard = function(width,height,numColors) {
    var board = [];
    var colors = _.range(numColors);
    // Generate first gem, from which to derive future rows (base case)
    board.push([_.first(_.shuffle(_.range(COLORS)))]);
    for (var x = 1; x < width; x++) {
        board[0].push(_.first(_.shuffle(_.without(colors,board[0][x-1]))));
    }
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

    // TODO Currently in row major.
    // Maybe _.zip.apply(_, board) to convert from row major to column major, or change above code
    return board;
};

// Generate a row major width x height 2 dimensional array of zeros
var generateNbyN = function(width,height) {
    var board = [];
    for (var y = 0; y < height; y++) {
        board.push(_.map(_.range(width),function(o) {return 0;}));
    }
    return board;
};

// Returns a cloned gemBoard with the given tiles swapped
var swap = function(gemBoard,ax,ay,bx,by) {
    var gemBoardClone = gemBoard.clone();
    gemBoardClone[by][bx] = gemBoard[ay][ax];
    gemBoardClone[ay][ax] = gemBoard[by][bx];
    return gemBoardClone;
};

// Perform an equality comparison for three elements, a convenience function
var threeEqual  = function(a,b,c) {
    if ((a === b) && (b === c))
        return true;

    return false;
}

// Check if a swap is valid by swapping and checking the changed rows and columns
var isSwapValid = function(gemBoard,ax,ay,bx,by) {
    // Are the tiles being swapped horizontally or vertically adjacent?
    if (!((Math.abs(ax-bx) === 1 && Math.abs(ay-by) === 0) ||
        (Math.abs(ax-bx) === 0 && Math.abs(ay-by) === 1)))
        return false;

    // TODO Optimize by removing swap
    var rowMajorGemBoard = swap(gemBoard,ax,ay,bx,by);

    for (var x = 2; x < GEM_BOARD_WIDTH; x++) {
        if (threeEqual(rowMajorGemBoard[ay][x-2],rowMajorGemBoard[ay][x-1],rowMajorGemBoard[ay][x]) ||
            threeEqual(rowMajorGemBoard[by][x-2],rowMajorGemBoard[by][x-1],rowMajorGemBoard[by][x])) {
            return true;
        }
    }

    for (var y = 2; y < GEM_BOARD_HEIGHT; y++) {
        if (threeEqual(rowMajorGemBoard[y-2][ax],rowMajorGemBoard[y-1][ax],rowMajorGemBoard[y][ax]) ||
            threeEqual(rowMajorGemBoard[y-2][bx],rowMajorGemBoard[y-1][bx],rowMajorGemBoard[y][bx])) {
            return true;
        }
    }

    return false;
};

var placeUnitsIntoQueue = function(gameId,role,colorsDestroyed) {
    for (var color = 0; color < COLORS; color++) {
        for (var count = 0; count < colorsDestroyed[color]; count++) {
            // If there is open space
            var unit = new UNIT_SCHEMA();
            unit.color = color;
            unit.role = role;
            unit.queued = true;
            unit.gameId = gameId;
            Units.insert(unit);
        }
    }
};

var evaluateGemBoard = function(rowMajor) {
    // Is there any activity due to destruction?
    var activity = false;
    // Bitmap of tiles to destroy
    var destroyedTiles = generateNbyN(GEM_BOARD_WIDTH,GEM_BOARD_HEIGHT);
    // Number of each color destroyed, indexed by color
    var colorsDestroyed = _.map(_.range(COLORS),function () {return 0;});
    // Emptied gemBoard
    var columnMajorNewGemBoard = [];
    // Replacement gems per column
    var replacementGemsPerColumn = [];

    // Get 3+ contiguous elements in rows. Mark them as destroyed. Perform a full-table analysis because this evaluation
    // might be used for cascades and arbitrary number of colors.
    for (var y = 0; y < GEM_BOARD_HEIGHT; y++) {
        for (var x = 2; x < GEM_BOARD_WIDTH; x++) {
            // If three are adjacent, get the color and add the tiles to destroyables
            if (threeEqual(rowMajor[y][x-2],rowMajor[y][x-1],rowMajor[y][x])) {
                activity = true;
                colorsDestroyed[rowMajor[y][x]]++;
                destroyedTiles[y][x] = 1;
                destroyedTiles[y][x-1] = 1;
                destroyedTiles[y][x-2] = 1;
            }
        }
    }

    // Get 3+ contiguous elements in columns
    for (var x = 0; x < GEM_BOARD_WIDTH; x++) {
        for (y = 2; y < GEM_BOARD_HEIGHT; y++) {
            if (threeEqual(rowMajor[y][x],rowMajor[y-1][x],rowMajor[y-2][x])) {
                activity = true;
                colorsDestroyed[rowMajor[y][x]]++;
                destroyedTiles[y][x] = 1;
                destroyedTiles[y-1][x] = 1;
                destroyedTiles[y-2][x] = 1;
            }
        }
    }

    // TODO: Make gemBoard algorithm that works in row major, or convert row major gemBoards to column major
    // Create new gemBoard
    for (var x = 0; x < GEM_BOARD_WIDTH; x++) {
        columnMajorNewGemBoard.push([]);
        replacementGemsPerColumn.push([]);
        for (var y = 0; y < GEM_BOARD_HEIGHT; y++) {
            if (!destroyedTiles[y][x]) {
                // Will push down the column later
                columnMajorNewGemBoard[x].push(rowMajor[y][x]);
            } else {
                // Using these replacement gems
                replacementGemsPerColumn[x].push(Math.floor(Math.random()*COLORS));
            }
        }

        // Add the gems in (push down the column of gems)
        for (var i = replacementGemsPerColumn[x].length-1; i >=0; i--) {
            columnMajorNewGemBoard[x].unshift(replacementGemsPerColumn[x][i])
        }
    }

    // Generate a row major version of the new gemBoard (some kind of UnderscoreJS wizardry)
    var rowMajorNewGemBoard = _.zip.apply(_, columnMajorNewGemBoard);

    // A doozy of a control structure, but has to be computed somewhere.
    return {activity:activity,destroyedTiles:destroyedTiles,colorsDestroyed:colorsDestroyed,
        rowMajorNewGemBoard:rowMajorNewGemBoard,replacementGemsPerColumn:replacementGemsPerColumn};
}

Meteor.methods({
    // Join a 1 player game. Otherwise, start a new game and wait. By convention, first player is bunny.
    startGame: function() {
        // Find a 1 player game.
        var g = Games.findOne({$where:"this.users.length < 2",closed:false});

        // Join the game if found.
        if (g) {
            var roles = g.roles;
            if (!_.has(roles,this.userId))
                roles[this.userId] = FARMER;
            Games.update({"_id":g._id},{$addToSet:{users:this.userId},$set:{roles:roles}});
            // Return the game id.
            return g._id;
        }

        // Otherwise, create a new game
        g = new GAME_SCHEMA();
        g.name = "Game #" + (Games.find({}).count() + 1).toString();
        g.bunny.gemBoard = generateGemBoard(GEM_BOARD_WIDTH,GEM_BOARD_HEIGHT,COLORS)
        g.farmer.gemBoard = generateGemBoard(GEM_BOARD_WIDTH,GEM_BOARD_HEIGHT,COLORS);
        g.users = [this.userId];
        g.roles[this.userId] = BUNNY;
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

        var swapValid = isSwapValid(getGemBoard(g,this.userId),ax,ay,bx,by);

        // Is the swap valid? If so, update the gemBoard and return true. Otherwise return false. The client is expected
        // to call evaluate when it's true.
        if (swapValid) {
            var boardUpdate = {};
            boardUpdate[getRole(g,this.userId) + ".gemBoard"] = swap(getGemBoard(g,this.userId),ax,ay,bx,by);
            Games.update({_id:gameId},{$set:boardUpdate});
            return true;
        } else {
            return false;
        }
    },

    // Evaluate the gemBoard and return a results object used for animation and more evaluation.
    evaluate: function(gameId) {
        var g = getGame(gameId);

        if (!g)
            throw new Meteor.Error(404,"The game cannot be found");

        if (g.closed)
            throw new Meteor.Error(403,"The game is closed.");

        if (_.indexOf(g.users,this.userId) == -1)
            throw new Meteor.Error(403,"You are not in this game.");

        var role = getRole(g,this.userId);

        var evaluation = evaluateGemBoard(getGemBoard(g,this.userId));

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

            // Place units into queue
            placeUnitsIntoQueue(gameId,role,evaluation.colorsDestroyed);

            // If this is a simulation, return the kill part of the results, because we're waiting on the replacement
            // gems anyway and do not want to update the boards.
            if (this.isSimulation)
                return results;

            // TODO Generate replacement gems deterministically so they can be simulated on the client
            results.replacementGemsPerColumn = evaluation.replacementGemsPerColumn;

            // Update gemBoard
            var boardUpdate = {};
            boardUpdate[role + ".gemBoard"] = evaluation.rowMajorNewGemBoard;

            Games.update({_id:gameId},{$set:boardUpdate});

            return results;
        }

        // No activity was recorded. Return false to let the client know: stop checking.
        return false;
    },

    // Advance the tug of war board one timestep and return a results object used for animation
    tug: function(gameId) {
        var g = getGame(gameId);

        if (!g)
            throw new Meteor.Error(404,"The game cannot be found");

        if (g.closed)
            throw new Meteor.Error(403,"The game is closed.");

        if (_.indexOf(g.users,this.userId) == -1)
            throw new Meteor.Error(403,"You are not in this game.");

        // End the game if either player's life is less than 1
        if (g.bunny.life < 1 || g.farmer.life < 1) {
            Games.update({_id:gameId},{$set:{closed:true}});
            return;
        }

        // Blow up units marked to get killed
        Units.remove({gameId:gameId,gettingKilled:true});

        // Move units
        Units.update({gameId:gameId,queued:false,role:BUNNY},{$inc:{x:-1}},{multi:true});
        Units.update({gameId:gameId,queued:false,role:FARMER},{$inc:{x:1}},{multi:true});

        // Mark units off board to die and increment life counters
        Units.update({gameId:gameId,queued:false,$or:[{x:{$gte:TUG_BOARD_WIDTH}},{x:{$lt:0}}]},
            {$set:{gettingKilled:true}},{multi:true});

        // Score units that made it to the other side
        var farmerLifeLost = Units.find({gameId:gameId,queued:false,role:BUNNY,x:{$lt:0}}).count();
        var bunnyLifeLost = Units.find({gameId:gameId,queued:false,role:FARMER,x:{$gte:TUG_BOARD_WIDTH}}).count();

        // Mark units that should kill each other.
        // First, overlapping destruction.
        for (var x = 0; x<TUG_BOARD_WIDTH; x++) {
            for (var y = 0; y<TUG_BOARD_HEIGHT; y++) {
                // TODO Situations where units of the same player overlap should be dealt with later
                var query = {gameId:gameId,queued:false,gettingKilled:false,x:x,y:y};
                var unitsCount = Units.find(query).count();
                if (unitsCount > 2) {
                    throw new Meteor.Error(500,"Units overlapping. check this out.");
                } else if (unitsCount == 2) {
                    Units.update(query,{$set:{gettingKilled:true}},{multi:true});
                }
            }
        }

        // Units on adjacent columns or equal rows should kill each other. Prevents units from "moving past" each other,
        // where we would otherwise never destroy units that are opposing because they never share a column.
        // Units that share the same space should also kill each other.
        for (var column = 0; column < TUG_BOARD_WIDTH-1; column++) {
            // If units share a column or an adjacent row, have opposite roles and the same color, pair off and mark
            // to die.
            var farmers = Units.find({gameId:gameId,queued:false,gettingKilled:false,role:FARMER,x:{$in:[column,column+1]}}).fetch();
            var bunnies = Units.find({gameId:gameId,queued:false,gettingKilled:false,role:BUNNY,x:{$in:[column,column+1]}}).fetch();

            _.each(farmers,function(farmer) {
                _.each(bunnies,function(bunny) {
                    if (farmer.color === bunny.color && !farmer.gettingKilled && !bunny.gettingKilled) {
                        farmer.target = bunny._id;
                        bunny.target = farmer._id;
                        farmer.gettingKilled = true;
                        bunny.gettingKilled = true;
                    }
                    bunny.evaluated = true;
                });
                farmer.evaluated = true;
            });

            // TODO Change to bulk update
            _.each(farmers.concat(bunnies),function(unit) {
                Units.update({_id:unit._id}, _.omit(unit,'_id'));
            });
        }

        // Unqueue units
        Units.find({gameId:gameId,queued:true}).forEach(function(unit){
            // Unit unqueueing is stochastic, so return on simulation
            if (Meteor.isSimulation)
                return;
            // If the unit is a Bunny, it wants to go to the right of the tug of war board. Otherwise, the left.
            var column = unit.role === BUNNY ? TUG_BOARD_WIDTH-1 : 0;
            // Find empty spaces to put the unit into
            var emptySpaces = _.difference( /*The difference between...*/
                _.range(TUG_BOARD_HEIGHT) /*...Total Spaces...*/,
                _.pluck(Units.find({x:column}).fetch(),"y" /*... and the occupied spaces in the specified columns*/));

            // If there is at least one empty space
            if (emptySpaces && emptySpaces.length > 0) {
                // Place the unit into a random empty horizontal.
                unit.y = _.first(_.shuffle(emptySpaces));
                unit.x = column;
                unit.queued = false;
            }

            // TODO Change to bulk update
            // Update the database
            Units.update({_id:unit._id}, _.omit(unit,'_id'));
        });

        // Increment lives calculated earlier
        Games.update({_id:gameId},{$inc:{"bunny.life":-bunnyLifeLost,"farmer.life":-farmerLifeLost}});
    }
});