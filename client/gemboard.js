/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

var GEM_TILE_SIZE = 48;

var touchEventData = {};

Template.gemboard.events = {
    'touchstart a':function(event) {
        // Prevent scrolling
        event.preventDefault();
        // Stores the origin point of this touch
        touchEventData.x = event.changedTouches[0].pageX;
        touchEventData.y = event.changedTouches[0].pageY;

        touchEventData.processed = false;
    },
    'touchmove, touchend a':function(event) {
        // Prevent scrolling
        event.preventDefault();

        // If this touch event is already handled, cancel.
        if (touchEventData.processed) {
            return;
        }

        // Initialize the swapping target tile's x and y with this tile's x and y
        var ax = this.x;
        var ay = this.y;
        var bx = ax;
        var by = ay;

        // If we are swiping right, increment bx
        if (event.changedTouches[0].pageX - touchEventData.x > 16) {
            bx++;
        // If we are swiping left, decrement bx
        } else if (event.changedTouches[0].pageX - touchEventData.x < -16) {
            bx--;
        // If we are swiping down, increment by
        } else if (event.changedTouches[0].pageY - touchEventData.y > 16) {
            by++;
        // If we are swiping up, decrement by
        } else if (event.changedTouches[0].pageY - touchEventData.y < -16) {
            by--;
        // Otherwise, do nothing.
        } else {
            return;
        }

        // If the swap is valid, update the database
        swapAndEvaluate(ax,ay,bx,by);

        touchEventData.processed = true;
    },
    'touchend a':function(event) {
        touchEventData.processed = false;
    }
};

Template.gemboard.preserve({
    '.gem[id]':function(node) {
        return node.id;
    }
});

Template.gemboard.gems = function() {
    return Gems.find({gameId:Session.get(CURRENT_GAME),role:Session.get(CURRENT_ROLE)}).map(function (gem) {
        gem.posX = gem.x*GEM_TILE_SIZE;
        gem.posY = gem.y*GEM_TILE_SIZE;
        gem.role = gem.role == BUNNY ? "bunny" : "farmer";
        gem.destroyed = gem.destroyed ? "destroyed" : "";
        return gem;
    });
}

var simulateSwap = function(ax,ay,bx,by) {
    if (ax < 0 || bx < 0 || ax >= GEM_BOARD_WIDTH || bx >= GEM_BOARD_WIDTH || ay < 0 || by < 0 || ay >= GEM_BOARD_HEIGHT
        || by >= GEM_BOARD_HEIGHT)
        return false;

    // An event handler when the failed swap transition ends
    var reverseSwap = function(event) {
        var tile = $(this);
        tile.css({left:parseInt(tile.attr('data-gem-x'))*GEM_TILE_SIZE,
            top:parseInt(tile.attr('data-gem-y'))*GEM_TILE_SIZE});
        this.removeEventListener(TRANSITION_END_EVENT,arguments.callee,false);
    }

    // Get the tiles
    var aTile = $('.posX'+ax.toString()+".posY"+ay.toString());
    var bTile = $('.posX'+bx.toString()+".posY"+by.toString());

    // When the transition simulated swap animation ends, reverse it
    aTile[0].addEventListener(TRANSITION_END_EVENT,reverseSwap,false);
    bTile[0].addEventListener(TRANSITION_END_EVENT,reverseSwap,false);

    // Change the positions, triggering a transition animation
    aTile.css({left:bx*GEM_TILE_SIZE,top:by*GEM_TILE_SIZE});
    bTile.css({left:ax*GEM_TILE_SIZE,top:ay*GEM_TILE_SIZE});

    return true;
}

var evaluateLoop = function(e,r) {
    if (r) {
        Meteor.setTimeout(function() {
            Meteor.call("evaluate",Session.get(CURRENT_GAME),evaluateLoop);
        },100);
    }
}

var swapAndEvaluate = function(ax,ay,bx,by) {
    Meteor.call("swap",Session.get(CURRENT_GAME),ax,ay,bx,by,function (e,r) {
        if (r) {
            Meteor.call("evaluate",Session.get(CURRENT_GAME),evaluateLoop);
        } else {
            simulateSwap(ax,ay,bx,by);
        }
    });
}

// Gets the kind of transition event for this browser
var TRANSITION_END_EVENT = (function (){
    var t;
    var el = document.createElement('fakeelement');
    var transitions = {
        'transition':'transitionend',
        'OTransition':'oTransitionEnd',
        'MozTransition':'transitionend',
        'WebkitTransition':'webkitTransitionEnd'
    }

    for(t in transitions){
        if( el.style[t] !== undefined ){
            return transitions[t];
        }
    }
})();