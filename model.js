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


COLORS = 5;
GEM_BOARD_WIDTH = 6;
GEM_BOARD_HEIGHT = 6;
TUG_BOARD_WIDTH = 6;
TUG_BOARD_HEIGHT = 3;
STARTING_LIFE = 20;
// How many milliseconds do we wait until we check the gemboard again for cascades? Used for animation too.
GEM_BOARD_NEXT_EVALUATION_DELAY = 400;

/*
* Gem game flow:
* 0. Generate board
* 1. Click two pieces.
* 2. If adjacent, continue. Otherwise, wait for 1.
* 3. If k>=3 of same color adjacent vertically or horizontally, continue. Otherwise, do not swap, wait for 1.
* 4. Kill k gems, move gems down to fill at top of columns in model. Spawn appropriate unit
* counts given the number of pieces killed by placing them into the unit queue.
* 5. Generate hidden gems at the top to replace old gems (in "negative space").
* 6. Kill k divs, generate new divs, run animation events, register animation on-complete events.
* 7. On animation complete/after a built-in model delay, go to 3 to check the new board.
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


BUNNY = 1;
FARMER = 2;

var Game = function() {
    this.name = "";
    this.bunny = {
        life:STARTING_LIFE,
        ready:false
    };
    this.farmer = {
        life:STARTING_LIFE,
        ready:false
    };
    this.users = [];
    // Get which role the user is playing
    this.roles = {};
    this.round = 1;
    // No winner set by default
    this.winner = 0;
    this.closed = false;
};

var Unit = function() {
    this.gameId = "";
    this.role = BUNNY;
    this.x = 0;
    this.y = 0;
    this.color = 0;
    this.destroyed = false;
    // Id of target when assigned.
    this.target = "";
    this.queued = false;
};

var Target = function(_x,_y) {
    this.x = _x;
    this.y = _y;
}

var Gem = function() {
    this.gameId = "";
    this.role = BUNNY;
    this.x=0;
    this.y=0;
    this.color=0;
    this.destroyed=false;
}

// Main collection containing games.
var Games = new Meteor.Collection("games");

// Collection containing units per game. Really handy to treat as separate collection.
var Units = new Meteor.Collection("units");

// Collection containing gems per game
var Gems = new Meteor.Collection("gems");

var getGame = function(gameId) {
    return Games.findOne({_id:gameId});
};

var getRole = function(gameDocument,userId) {
    return gameDocument.roles[userId];
};

var getRandomColor = function(numColors) {
    return _.first(_.shuffle(_.range(numColors)));
}

// Generate a row major width x height 2 dimensional array of zeros
var generateNbyN = function(width,height,init) {
    var rowMajor = [];
    for (var y = 0; y < height; y++) {
        rowMajor.push(_.map(_.range(width),function(o) {return 0;}));
    }
    return rowMajor;
};

// Perform an equality comparison for three elements, a convenience function
var threeEqual  = function(a,b,c) {
    if ((a === b) && (b === c))
        return true;

    return false;
}

// Check that the game is ready
var gameReady = function(gameDocument) {
    if (!gameDocument)
        throw new Meteor.Error(404,"The game cannot be found");

    if (gameDocument.closed)
        throw new Meteor.Error(403,"The game is closed.");

    if (gameDocument.users.length < 2)
        throw new Meteor.Error(500,"Waiting for someone to join the game...");

    if (!gameDocument.bunny.ready)
        throw new Meteor.Error(500,"The Bunny isn't ready to play yet.");

    if (!gameDocument.farmer.ready)
        throw new Meteor.Error(500,"The Farmer isn't ready to play yet.");

    return true;
}

// Creates a sparse matrix as a function with mutable data and immutable structure
var matrix = function() {
    var binding = {};
    var data = _.flatten(Array.prototype.slice.call(arguments));
    var empty = {};
    _.each(data,function (item) {
        if (item && _.has(item,'x') && _.has(item,'y')) {
            empty["a" + item.y.toString() + "x" + item.x.toString()] = item;
        }
    });
    binding.data = empty;
    return _.bind(function(x,y){
        return this.data["a" + y.toString() + "x" + x.toString()];
    },binding);
}


// Generates a double-height gemboard that contains the current gemboard elements and an initial batch of new elements.
var generateGemboard = function(width,height,numColors) {
    var board = [];
    var colors = _.range(numColors);
    // Generate first gem, from which to derive future rows (base case)
    board.push([_.first(_.shuffle(_.range(COLORS)))]);
    for (var x = 1; x < width; x++) {
        board[0].push(_.first(_.shuffle(_.without(colors,board[0][x-1]))));
    }
    for (var y = 1; y < height*2; y++) {
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

var appendNewGemboardToGemCollection = function(gameId,role,rowMajor) {
    for (var y = 0; y < rowMajor.length; y++) {
        for (var x = 0; x < rowMajor[y].length; x++) {
            var g = new Gem();
            g.x = x;
            // Places gems into a hidden area above where they are not evaluated but ready to be inserted into the main
            // gemboard field.
            g.y = y-GEM_BOARD_HEIGHT;
            g.role = role;
            g.gameId = gameId;
            g.color = rowMajor[y][x];
            g.destroyed = false;
            Gems.insert(g);
        }
    }
}

var initializeGemboard = function(gameId,role) {
    appendNewGemboardToGemCollection(gameId,role,generateGemboard(GEM_BOARD_WIDTH, GEM_BOARD_HEIGHT, COLORS));
}

var isSwapValid = function(gameId,role,ax,ay,bx,by) {
    // Are the tiles valid?
    if (ax < 0 || ay < 0 || ax > GEM_BOARD_WIDTH || ay > GEM_BOARD_HEIGHT)
        return false;

    // Are the tiles being swapped horizontally or vertically adjacent?
    if (!((Math.abs(ax-bx) === 1 && Math.abs(ay-by) === 0) ||
        (Math.abs(ax-bx) === 0 && Math.abs(ay-by) === 1)))
        return false;

    // Get gems
    var aQuery = Gems.find({gameId:gameId,role:role,$or:[{x:ax},{y:ay}]}).fetch();
    var bQuery = Gems.find({gameId:gameId,role:role,$or:[{x:bx},{y:by}]}).fetch();

    // Perform temporary swap
    var m = matrix(aQuery,bQuery);
    var tempColor = m(ax,ay).color;
    m(ax,ay).color = m(bx,by).color;
    m(bx,by).color = tempColor;
    // Bind to color by default
    var m_color = _.bind(function(x,y){return this(x,y).color},m);

    // Check if this swap causes a change
    for (var x = 2; x < GEM_BOARD_WIDTH; x++) {
        if (threeEqual(m_color(x-2,ay),m_color(x-1,ay),m_color(x,ay)) ||
            threeEqual(m_color(x-2,by),m_color(x-1,by),m_color(x,by))) {
            return true;
        }
    }

    for (var y = 2; y < GEM_BOARD_HEIGHT; y++) {
        if (threeEqual(m_color(ax,y-2),m_color(ax,y-1),m_color(ax,y)) ||
            threeEqual(m_color(bx,y-2),m_color(bx,y-1),m_color(bx,y))) {
            return true;
        }
    }

    return false;
}

var swap = function(gameId,role,ax,ay,bx,by) {
    if (!isSwapValid(gameId,role,ax,ay,bx,by))
        return false;

    // Swap the gems. Store the gemB id to be the "temp" of the swap.
    var gemB = Gems.findOne({gameId:gameId,role:role,x:bx,y:by})._id;
    Gems.update({gameId:gameId,role:role,x:ax,y:ay},{$set:{x:bx,y:by}});
    Gems.update(gemB,{$set:{x:ax,y:ay}});

    return true;
}

var evaluateGemboard = function(gameId,role) {
    // Is there any activity due to destruction?
    var activity = false;

    // Will we destroy some gems?
    if (Gems.find({gameId:gameId,role:role,destroyed:true}).count() > 0) {
        // Delete the gems that were marked as destroyed from previous rounds
        Gems.remove({gameId:gameId,role:role,destroyed:true});

        activity = true;
    }

    // Get gems in the visible field
    var m = matrix(Gems.find({gameId:gameId,role:role,y:{$gte:0},destroyed:false}).fetch());

    // Bind convenience functions (lookup tables)
    var m_color = _.bind(function(x,y) {return this(x,y).color},m);
    var m_id = _.bind(function(x,y) {return this(x,y)._id},m);


    // List of gems to destroy
    var destroyedGems = [];
    // Number of each color destroyed, indexed by color
    var colorsDestroyed = _.map(_.range(COLORS),function () {return 0;});

    // Get 3+ contiguous elements in rows. Mark them as destroyed. Perform a full-table analysis because this evaluation
    // might be used for cascades and arbitrary number of colors.
    for (var y = 0; y < GEM_BOARD_HEIGHT; y++) {
        for (var x = 2; x < GEM_BOARD_WIDTH; x++) {
            // If three are adjacent, get the color and add the tiles to destroyables
            if (threeEqual(m_color(x-2,y),m_color(x-1,y),m_color(x,y))) {
                activity = true;
                colorsDestroyed[m_color(x,y)]++;
                destroyedGems = destroyedGems.concat([m_id(x-2,y),m_id(x-1,y),m_id(x,y)]);
            }
        }
    }

    // Get 3+ contiguous elements in columns
    for (var x = 0; x < GEM_BOARD_WIDTH; x++) {
        for (y = 2; y < GEM_BOARD_HEIGHT; y++) {
            if (threeEqual(m_color(x,y-2),m_color(x,y-1),m_color(x,y))) {
                activity = true;
                colorsDestroyed[m_color(x,y)]++;
                destroyedGems = destroyedGems.concat([m_id(x,y-2),m_id(x,y-1),m_id(x,y)]);
            }
        }
    }

    // Remove duplicates
    destroyedGems = _.uniq(destroyedGems);

    // Destroy gems
    Gems.update({_id:{$in:destroyedGems}},{$set:{destroyed:true}},{multi:true});

    // Slide down tiles
    // TODO Coalesce removal updates
    _.each(destroyedGems,function(destroyedId){
        var destroyed = Gems.findOne(destroyedId);

        // Update the new position of each gem in the column above the destroyed gem
        Gems.update({gameId:gameId,role:role,x:destroyed.x,y:{$lte:destroyed.y},destroyed:false},{$inc:{y:1}},{multi:true});

        // Insert a replacement gem into the negative space
        Gems.insert({gameId:gameId,role:role,x:destroyed.x,y:-GEM_BOARD_HEIGHT,color:getRandomColor(COLORS),destroyed:false});
    });

    // Place units into the queue to be unqueued by a "tug" call later
    for (var color = 0; color < COLORS; color++) {
        for (var count = 0; count < colorsDestroyed[color]; count++) {
            var unit = new Unit();
            unit.color = color;
            unit.role = role;
            unit.queued = true;
            unit.gameId = gameId;
            Units.insert(unit);
        }
    }

    return activity;
}

Meteor.methods({
    // Join a 1 player game. Otherwise, start a new game and wait. By convention, first player is bunny.
    startGame: function() {
        // Find a 1 player game.
        var g = Games.findOne({closed:false,full:false});

        // Join the game if found.
        if (g) {
            if (!_.has(g.roles,this.userId))
                g.roles[this.userId] = FARMER;
            Games.update({"_id":g._id},{$addToSet:{users:this.userId},$set:{roles:g.roles,full:true}});
            // Return the game id.
            return g._id;
        }

        // Otherwise, create a new game
        g = new Game();

        g.name = "Game #" + (Games.find({}).count() + 1).toString();
        g.users = [this.userId];
        g.roles[this.userId] = BUNNY;
        g.full=false;

        var gameId = Games.insert(g);

        // Initialize gemboards
        if (!gameId)
            throw new Meteor.Error(500,"Game was not created.");

        initializeGemboard(gameId,BUNNY);
        initializeGemboard(gameId,FARMER);

        return gameId;
    },

    // Tell the server you're ready to play
    ready:function(gameId) {
        var g = Games.findOne({closed:false});

        if (!g)
            throw new Meteor.Error(404,"No game found.");

        var role = getRole(g,this.userId);

        if (!role)
            throw new Meteor.Error(500,"You have not been assigned a role.");

        var update = {};
        update[(role === BUNNY ? 'bunny.' : 'farmer.') + 'ready'] = true;
        Games.update({_id:gameId},{$set:update});
    },

    // Test a swap and return true if it satisfies conditions
    swap: function(gameId,ax,ay,bx,by) {
        var g = getGame(gameId);

        gameReady(g);

        var role = getRole(g,this.userId);

        if (!role)
            throw new Meteor.Error(500,"No role was assigned or one was not found.");


        return swap(gameId,role,ax,ay,bx,by);
    },

    // Evaluate the gemboard and return a results object used for animation and more evaluation.
    evaluate: function(gameId) {
        var g = getGame(gameId);

        gameReady(g);

        var role = getRole(g,this.userId);

        if (!role)
            throw new Meteor.Error(500,"No role was assigned or one was not found.");

        return evaluateGemboard(gameId,role);
    },

    // Advance the tug of war board one timestep (move units, make fighting happen, etc.)
    tug: function(gameId) {
        var g = getGame(gameId);

        gameReady(g);

        // Are we moving bunnies or farmers?
        // BUNNY = 1, FARMER = 2
        var moving = g.round % 2 + 1;

        // End the game if either player's life is less than 1
        if (g.bunny.life < 1 || g.farmer.life < 1) {
            Games.update({_id:gameId},{$set:{closed:true,winner:g.bunny.life < 1 ? FARMER : BUNNY}});
            return;
        }

        // Blow up units marked to get killed
        Units.remove({gameId:gameId,destroyed:true});

        // Move units
        Units.update({gameId:gameId,queued:false,role:moving},{$inc:{x:[-1,1][moving-1]}},{multi:true});

        // Score units that made it to the other side
        var farmerLifeLost = Units.find({gameId:gameId,queued:false,destroyed:false,role:BUNNY,x:{$lt:0}}).count();
        var bunnyLifeLost = Units.find({gameId:gameId,queued:false,destroyed:false,role:FARMER,x:{$gte:TUG_BOARD_WIDTH}}).count();

        // Mark units off board to die and increment life counters
        Units.update({gameId:gameId,queued:false,$or:[{role:FARMER,x:{$gte:TUG_BOARD_WIDTH}},{role:BUNNY,x:{$lt:0}}]},
            {$set:{destroyed:true}},{multi:true});

        // Mark units that should kill each other.
        var units = Units.find({gameId:gameId,queued:false,destroyed:false}).fetch();
        // Create a convenience lookup table of units in a grid
        var unitsMatrix = matrix(units);
        // A list of id's to mark for death
        var toDie = [];

        // If the units are in adjacent columns, the same row and opposite roles, they should kill each other.
        for (var x = 0; x < TUG_BOARD_WIDTH+1; x++) {
            for (var y = 0; y < TUG_BOARD_HEIGHT; y++) {
                // If units are on adjacent columns and have opposing roles, mark them to die
                if (unitsMatrix(x,y) && unitsMatrix(x-1,y) && unitsMatrix(x,y).role !== unitsMatrix(x-1,y).role) {
                    toDie = toDie.concat([unitsMatrix(x,y)._id,unitsMatrix(x-1,y)._id]);
                }
            }
        }

        // If the units are in the same column, different roles and same color, they should kill each other. This is the
        // "color bonus" where same color units can kill each other side to side.
        for (var x = 0; x < TUG_BOARD_WIDTH; x++) {
            var farmers = _.filter(units,function (u) {return u.role === FARMER && u.x === x});
            var bunnies = _.filter(units,function (u) {return u.role === BUNNY && u.x === x});

            _.each(farmers,function(farmer) {
                _.each(bunnies,function(bunny) {
                    if (farmer.color === bunny.color && !farmer.destroyed && !bunny.destroyed) {
                        toDie = toDie.concat([farmer._id,bunny._id]);
                    }
                });
            });
        }

        // Bulk update unit destruction
        if (toDie.length > 1)
            Units.update({_id:{$in:toDie}},{$set:{destroyed:true}},{multi:true});

        // Increment lives and round calculated earlier
        Games.update({_id:gameId},{$inc:{"bunny.life":-bunnyLifeLost,"farmer.life":-farmerLifeLost,round:1}});
    },

    // Spawn queued units onto the negative spaces behind and in front of the tugboard
    spawn: function(gameId) {
        var g = getGame(gameId);

        gameReady(g);

        // Unqueue units
        _.each(Units.find({gameId:gameId,queued:true}).fetch(),function(unit){
            // Unit unqueueing is stochastic, so return on simulation
            if (Meteor.isSimulation)
                return;
            // If the unit is a Bunny, it wants to go to the right of the tug of war board. Otherwise, the left.
            var column = unit.role === BUNNY ? TUG_BOARD_WIDTH : -1;
            // Find empty spaces to put the unit into
            var emptySpaces = _.difference( /*The difference between...*/
                _.range(TUG_BOARD_HEIGHT) /*...Total Spaces...*/,
                _.pluck(Units.find({gameId:gameId,x:column}).fetch(),"y" /*... and the occupied rows in the specified column*/));

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
    }
});