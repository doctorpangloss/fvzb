/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

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
        unit.posX = unit.x*48;
        unit.posY = unit.y*48;
        unit.role = unit.role == BUNNY ? "bunny" : "farmer";
        unit.destroyed = unit.destroyed ? "destroyed" : "";
        unit.colorName = ["red","orange","yellow","green","blue","purple"][unit.color];
        unit.roleName = unit.role.charAt(0);
        return unit;
    });
}