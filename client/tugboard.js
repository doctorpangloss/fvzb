/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

var TUGBOARD_TILE_SIZE = 48;

Template.tugboard.events = {
    'click, tap a':function(event) {
        //...
    }
};

Template.tugboard.preserve({
    '.unit[id]':function(node) {
        return node.id;
    }
});

Template.tugboard.units = function() {
    return Units.find({gameId:Session.get(CURRENT_GAME),queued:false}).map(function (unit) {
        unit.posX = unit.x*TUGBOARD_TILE_SIZE;
        unit.posY = unit.y*TUGBOARD_TILE_SIZE;
        unit.role = unit.role == BUNNY ? "bunny" : "farmer";
        unit.destroyed = unit.destroyed ? "destroyed" : "";
        return unit;
    });
}