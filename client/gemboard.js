/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

Template.gemboard.events = {
    'click a':function(event) {
        var gem = Gems.findOne($(event.target).attr('id'));

        if (Session.get(CURRENT_GEM_SELECTION)) {
            var prevGem = Session.get(CURRENT_GEM_SELECTION);
            swapAndEvaluate(gem.x,gem.y,prevGem.x,prevGem.y);
            Session.set(CURRENT_GEM_SELECTION,null);
        } else {
            Session.set(CURRENT_GEM_SELECTION,gem);
        }
    }
};

Template.gemboard.preserve({
    '.gem[id]':function(node) {
        return node.id;
    }
});

Template.gemboard.gems = function() {
    return Gems.find({gameId:Session.get(CURRENT_GAME),role:Session.get(CURRENT_ROLE)}).map(function (gem) {
        gem.posX = gem.x*96;
        gem.posY = gem.y*96;
        gem.role = BUNNY ? "bunny" : "farmer";
        gem.destroyed = gem.destroyed ? "destroyed" : "";
        return gem;
    });
}

var evaluateLoop = function(e,r) {
    if (r) {
        Meteor.setTimeout(function() {
            Meteor.call("evaluate",Session.get(CURRENT_GAME),evaluateLoop);
        },400);
    }
}

var swapAndEvaluate = function(ax,ay,bx,by) {
    Meteor.call("swap",Session.get(CURRENT_GAME),ax,ay,bx,by,function (e,r) {
        if (r) {
            Meteor.call("evaluate",Session.get(CURRENT_GAME),evaluateLoop);
        }
    });
}